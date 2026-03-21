import type { BaseMessage } from '@langchain/core/messages';
import { type AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';

import { workoutAnalysisSchema } from '@/types/gemini-analysis';
import type { WorkoutAnalysis } from '@/types/gemini-analysis';

import {
  ACTIVITY_ANALYSIS_SYSTEM_PROMPT,
  buildActivityUserPrompt,
} from '../prompts/activity-analysis';
import { createGeminiModel } from './model';
import { getAllWorkoutTools } from './tools/workout-tools';

const MAX_TOOL_ROUNDS = 8;
const SCHEMA_RETRY_LIMIT = 1;

export type AgentErrorCode =
  | 'langchain_tool_error'
  | 'gemini_schema_invalid'
  | 'gemini_timeout'
  | 'gemini_invoke_error'
  | 'gemini_empty_response'
  | 'max_rounds_exceeded'
  | 'strava_404_deleted';

export interface RunAgentInput {
  activityId: string;
  athleteName?: string | undefined;
  athleteGoal?: string | undefined;
}

export interface AgentResult {
  analysis: WorkoutAnalysis;
  toolCallCount: number;
  rounds: number;
}

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  phase: 'invoke' | 'tool' | 'parse';
}

export async function runWorkoutAgent(
  input: RunAgentInput,
): Promise<{ ok: true; data: AgentResult } | { ok: false; error: AgentError }> {
  const model = createGeminiModel();
  const tools = getAllWorkoutTools();
  const toolMap = new Map<string, StructuredToolInterface>(tools.map((t) => [t.name, t]));
  const boundModel = model.bindTools(tools);

  let totalToolCalls = 0;

  const messages: BaseMessage[] = [
    new SystemMessage(ACTIVITY_ANALYSIS_SYSTEM_PROMPT),
    new HumanMessage(buildActivityUserPrompt(input)),
  ];

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: AIMessage;
    try {
      response = (await boundModel.invoke(messages)) as AIMessage;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isTimeout = msg.toLowerCase().includes('timeout') || msg.includes('DEADLINE_EXCEEDED');
      return {
        ok: false,
        error: {
          code: isTimeout ? 'gemini_timeout' : 'gemini_invoke_error',
          message: msg,
          phase: 'invoke',
        },
      };
    }

    messages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const text = extractText(response);
      if (!text) {
        return {
          ok: false,
          error: {
            code: 'gemini_empty_response',
            message: 'Model returned an empty response with no tool calls',
            phase: 'parse',
          },
        };
      }

      const result = parseAnalysis(text, totalToolCalls, round + 1);
      if (!result.ok && result.error.code === 'gemini_schema_invalid') {
        return retryOnSchemaFailure(messages, boundModel, text, totalToolCalls, round + 1);
      }
      return result;
    }

    totalToolCalls += toolCalls.length;

    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        const toolFn = toolMap.get(tc.name);
        if (!toolFn) {
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
          });
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result: string = await toolFn.invoke(tc.args);

          const parsed: unknown = JSON.parse(result);
          if (typeof parsed === 'object' && parsed !== null && 'error' in parsed) {
            const errText = (parsed as { error: string }).error;
            if (errText.includes('not found') || errText.includes('404')) {
              console.warn(`[workout-agent] Tool ${tc.name} returned not-found: ${errText}`);
            }
          }

          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: result,
          });
        } catch (err) {
          console.error(
            `[workout-agent] Tool ${tc.name} threw: ${err instanceof Error ? err.message : String(err)}`,
          );
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: JSON.stringify({
              error: `Tool failed: ${err instanceof Error ? err.message : String(err)}`,
            }),
          });
        }
      }),
    );

    messages.push(...toolResults);
  }

  return {
    ok: false,
    error: {
      code: 'max_rounds_exceeded',
      message: `Exceeded ${String(MAX_TOOL_ROUNDS)} tool-calling rounds`,
      phase: 'invoke',
    },
  };
}

async function retryOnSchemaFailure(
  messages: BaseMessage[],
  boundModel: ReturnType<ReturnType<typeof createGeminiModel>['bindTools']>,
  failedText: string,
  toolCallCount: number,
  currentRound: number,
): Promise<{ ok: true; data: AgentResult } | { ok: false; error: AgentError }> {
  for (let retry = 0; retry < SCHEMA_RETRY_LIMIT; retry++) {
    console.warn(
      `[workout-agent] Schema validation failed, retry ${String(retry + 1)}/${String(SCHEMA_RETRY_LIMIT)}`,
    );

    messages.push(
      new HumanMessage(
        `Your previous response was not valid JSON matching the required schema. Here is what you returned:\n\n${failedText.slice(0, 2000)}\n\nPlease try again. Return ONLY a valid JSON object matching the analysis schema.`,
      ),
    );

    let response: AIMessage;
    try {
      response = (await boundModel.invoke(messages)) as AIMessage;
    } catch (err) {
      return {
        ok: false,
        error: {
          code: 'gemini_invoke_error',
          message: `Retry invoke failed: ${err instanceof Error ? err.message : String(err)}`,
          phase: 'invoke',
        },
      };
    }

    messages.push(response);
    const text = extractText(response);
    const result = parseAnalysis(text, toolCallCount, currentRound + retry + 1);
    if (result.ok) return result;

    failedText = text;
  }

  return {
    ok: false,
    error: {
      code: 'gemini_schema_invalid',
      message: `Schema validation failed after ${String(SCHEMA_RETRY_LIMIT)} retries`,
      phase: 'parse',
    },
  };
}

function extractText(response: AIMessage): string {
  if (typeof response.content === 'string') return response.content;
  if (!Array.isArray(response.content)) return '';

  return response.content
    .filter((block): block is { type: 'text'; text: string } => {
      return typeof block === 'object' && 'type' in block && block.type === 'text';
    })
    .map((block) => block.text)
    .join('');
}

function parseAnalysis(
  text: string,
  toolCallCount: number,
  rounds: number,
): { ok: true; data: AgentResult } | { ok: false; error: AgentError } {
  let jsonText = text.trim();

  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/;
  const fenceMatch = fenceRegex.exec(jsonText);
  if (fenceMatch?.[1]) {
    jsonText = fenceMatch[1].trim();
  }

  try {
    const parsed: unknown = JSON.parse(jsonText);
    const result = workoutAnalysisSchema.safeParse(parsed);

    if (!result.success) {
      return {
        ok: false,
        error: {
          code: 'gemini_schema_invalid',
          message: `Schema validation failed: ${result.error.message}`,
          phase: 'parse',
        },
      };
    }

    return {
      ok: true,
      data: { analysis: result.data, toolCallCount, rounds },
    };
  } catch (err) {
    return {
      ok: false,
      error: {
        code: 'gemini_schema_invalid',
        message: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        phase: 'parse',
      },
    };
  }
}
