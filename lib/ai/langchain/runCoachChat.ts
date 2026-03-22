import type { BaseMessage } from '@langchain/core/messages';
import { type AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { StructuredToolInterface } from '@langchain/core/tools';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { getPersonalityPrompt } from '@/lib/coach-personalities';

import { buildCoachChatSystemPrompt, buildChatContextPrefix } from '../prompts/coach-chat';
import type { ChatPromptContext } from '../prompts/coach-chat';
import { createModel } from './model';
import { getConvexClient } from './tools/convex-client';
import { getAllWorkoutTools } from './tools/workout-tools';

const MAX_TOOL_ROUNDS = 5;

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

interface AthleteContext {
  text: string;
  coachPersonality: string | null;
}

async function prefetchAthleteContext(athleteId: string): Promise<AthleteContext> {
  const convex = getConvexClient();
  const typedId = athleteId as Id<'athletes'>;

  const [profile, formSnapshot, recentActivities] = await Promise.all([
    convex.query(api.athletes.getProfileForAnalysis, { athleteId: typedId }).catch(() => null),
    convex.query(api.formSnapshots.getLatestForAthlete, { athleteId: typedId }).catch(() => null),
    convex
      .query(api.activities.listRecentForAthlete, { athleteId: typedId, limit: 7 })
      .catch(() => []),
  ]);

  const parts: string[] = ['## Athlete Data (pre-fetched — use tools only for deeper queries)'];
  let coachPersonality: string | null = null;

  if (profile) {
    parts.push('\n### Profile');
    if (profile.firstName) parts.push(`- Name: ${profile.firstName}`);
    if (profile.sex) parts.push(`- Sex: ${profile.sex}`);
    if (profile.goalText) parts.push(`- Goal: ${profile.goalText}`);
    coachPersonality = profile.coachPersonality ?? null;
  }

  if (formSnapshot) {
    parts.push('\n### Current Form');
    parts.push(`- CTL (Fitness): ${String(formSnapshot.ctl)}`);
    parts.push(`- ATL (Fatigue): ${String(formSnapshot.atl)}`);
    parts.push(`- TSB (Form): ${String(formSnapshot.tsb)}`);
    if (formSnapshot.acwr != null) parts.push(`- ACWR: ${String(formSnapshot.acwr)}`);
    parts.push(`- Date: ${formSnapshot.date}`);
  } else {
    parts.push('\n### Current Form\n- No form data available yet');
  }

  if (recentActivities.length > 0) {
    parts.push('\n### Recent Activities');
    for (const a of recentActivities) {
      const km = (a.distanceMeters / 1000).toFixed(1);
      const min = Math.round(a.movingTimeSec / 60);
      const daysAgo = Math.round(
        (Date.now() - new Date(a.startDate).getTime()) / (1000 * 60 * 60 * 24),
      );
      const hrPart = a.averageHeartrate ? `, ${String(Math.round(a.averageHeartrate))}bpm` : '';
      const trimpPart = a.trimp ? `, TRIMP ${String(Math.round(a.trimp))}` : '';
      parts.push(
        `- ${String(daysAgo)}d ago: ${a.name} (${a.sportType}, ${km}km, ${String(min)}min${hrPart}${trimpPart}) [activityId: ${a._id}]`,
      );
    }
  } else {
    parts.push('\n### Recent Activities\n- No activities found');
  }

  return { text: parts.join('\n'), coachPersonality };
}

export async function runCoachChat(
  input: ChatInput,
): Promise<{ ok: true; data: ChatResult } | { ok: false; error: string }> {
  let model: ReturnType<typeof createModel>;
  try {
    model = createModel();
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const tools = getAllWorkoutTools();
  const toolMap = new Map<string, StructuredToolInterface>(tools.map((t) => [t.name, t]));
  const boundModel = model.bindTools(tools);

  let athleteContextText = '';
  let personalityPrompt: string | null = null;
  if (input.context.athleteId) {
    try {
      const ctx = await prefetchAthleteContext(input.context.athleteId);
      athleteContextText = ctx.text;
      personalityPrompt = getPersonalityPrompt(ctx.coachPersonality);
    } catch (err) {
      console.warn(
        `[coach-chat] Failed to prefetch context: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const contextPrefix = buildChatContextPrefix(input.context);

  const messages: BaseMessage[] = [
    new SystemMessage(buildCoachChatSystemPrompt(personalityPrompt)),
    ...input.history.map((msg) =>
      msg.role === 'user'
        ? new HumanMessage(msg.text)
        : new SystemMessage(`[Previous coach response]: ${msg.text}`),
    ),
    new HumanMessage(`${contextPrefix}\n\n${athleteContextText}\n\nAthlete says: ${input.message}`),
  ];

  let totalToolCalls = 0;

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
    console.log(
      `[coach-chat] Round ${String(round + 1)}: ${String(toolCalls.length)} tool call(s) — ${toolCalls.map((tc) => tc.name).join(', ')}`,
    );

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
          return new ToolMessage({ tool_call_id: tc.id ?? tc.name, content: result });
        } catch (err) {
          console.error(
            `[coach-chat] Tool ${tc.name} threw: ${err instanceof Error ? err.message : String(err)}`,
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
