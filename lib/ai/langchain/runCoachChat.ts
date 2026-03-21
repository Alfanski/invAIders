import type { BaseMessage } from '@langchain/core/messages';
import { type AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';

import { COACH_CHAT_SYSTEM_PROMPT, buildChatContextPrefix } from '../prompts/coach-chat';
import type { ChatPromptContext } from '../prompts/coach-chat';
import { createGeminiModel } from './model';
import { getAllWorkoutTools } from './tools/workout-tools';

const MAX_TOOL_ROUNDS = 6;

export interface ChatMessage {
  role: 'user' | 'coach';
  text: string;
}

export interface ChatInput {
  message: string;
  history: readonly ChatMessage[];
  context: ChatPromptContext;
}

export interface ChatResult {
  message: string;
  toolCallCount: number;
}

export async function runCoachChat(
  input: ChatInput,
): Promise<{ ok: true; data: ChatResult } | { ok: false; error: string }> {
  const model = createGeminiModel();
  const tools = getAllWorkoutTools();
  const toolMap = new Map<string, StructuredToolInterface>(tools.map((t) => [t.name, t]));
  const boundModel = model.bindTools(tools);

  let totalToolCalls = 0;

  const contextPrefix = buildChatContextPrefix(input.context);

  const messages: BaseMessage[] = [new SystemMessage(COACH_CHAT_SYSTEM_PROMPT)];

  for (const msg of input.history) {
    if (msg.role === 'user') {
      messages.push(new HumanMessage(msg.text));
    } else {
      messages.push(new SystemMessage(`[Previous coach response]: ${msg.text}`));
    }
  }

  messages.push(new HumanMessage(`${contextPrefix}\n\nAthlete says: ${input.message}`));

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    let response: AIMessage;
    try {
      response = (await boundModel.invoke(messages)) as AIMessage;
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }

    messages.push(response);

    const toolCalls = response.tool_calls;
    if (!toolCalls || toolCalls.length === 0) {
      const text = extractText(response);
      if (!text) {
        return { ok: false, error: 'Model returned an empty response' };
      }
      return { ok: true, data: { message: text, toolCallCount: totalToolCalls } };
    }

    totalToolCalls += toolCalls.length;

    const toolResults = await Promise.all(
      toolCalls.map(async (tc) => {
        console.log(`[coach-chat] Tool call: ${tc.name}(${JSON.stringify(tc.args)})`);
        const toolFn = toolMap.get(tc.name);
        if (!toolFn) {
          console.warn(`[coach-chat] Unknown tool: ${tc.name}`);
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: JSON.stringify({ error: `Unknown tool: ${tc.name}` }),
          });
        }

        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const result: string = await toolFn.invoke(tc.args);
          console.log(
            `[coach-chat] Tool ${tc.name} returned ${String(result.length)} chars: ${result.slice(0, 200)}`,
          );
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: result,
          });
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.error(`[coach-chat] Tool ${tc.name} threw: ${errMsg}`);
          return new ToolMessage({
            tool_call_id: tc.id ?? tc.name,
            content: JSON.stringify({
              error: `Tool failed: ${errMsg}`,
            }),
          });
        }
      }),
    );

    messages.push(...toolResults);
  }

  return {
    ok: false,
    error: `Exceeded ${String(MAX_TOOL_ROUNDS)} tool-calling rounds`,
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
