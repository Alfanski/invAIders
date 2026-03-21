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
      return {
        ok: false,
        error: {
          message: err instanceof Error ? err.message : String(err),
          phase: 'invoke',
        },
      };
    }

    messages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const text = extractText(response);
      return parseAnalysis(text, totalToolCalls, round + 1);
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
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: result,
          });
        } catch (err) {
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
      message: `Exceeded ${String(MAX_TOOL_ROUNDS)} tool-calling rounds`,
      phase: 'invoke',
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
        message: `JSON parse failed: ${err instanceof Error ? err.message : String(err)}`,
        phase: 'parse',
      },
    };
  }
}
