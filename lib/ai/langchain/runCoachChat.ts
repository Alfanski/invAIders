import { type AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { COACH_CHAT_SYSTEM_PROMPT } from '../prompts/coach-chat';
import type { ChatPromptContext } from '../prompts/coach-chat';
import { createGeminiModel } from './model';
import { getConvexClient } from './tools/convex-client';

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

async function prefetchAthleteContext(athleteId: string): Promise<string> {
  const convex = getConvexClient();
  const typedId = athleteId as Id<'athletes'>;

  const [profile, formSnapshot, recentActivities] = await Promise.all([
    convex.query(api.athletes.getProfileForAnalysis, { athleteId: typedId }).catch(() => null),
    convex.query(api.formSnapshots.getLatestForAthlete, { athleteId: typedId }).catch(() => null),
    convex
      .query(api.activities.listRecentForAthlete, { athleteId: typedId, limit: 7 })
      .catch(() => []),
  ]);

  const parts: string[] = ['## Athlete Data (pre-fetched, do NOT call tools)'];

  if (profile) {
    parts.push('\n### Profile');
    if (profile.firstName) parts.push(`- Name: ${profile.firstName}`);
    if (profile.sex) parts.push(`- Sex: ${profile.sex}`);
    if (profile.goalText) parts.push(`- Goal: ${profile.goalText}`);
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
        `- ${String(daysAgo)}d ago: ${a.name} (${a.sportType}, ${km}km, ${String(min)}min${hrPart}${trimpPart})`,
      );
    }
  } else {
    parts.push('\n### Recent Activities\n- No activities found');
  }

  return parts.join('\n');
}

export async function runCoachChat(
  input: ChatInput,
): Promise<{ ok: true; data: ChatResult } | { ok: false; error: string }> {
  const model = createGeminiModel();

  let athleteContext = '';
  if (input.context.athleteId) {
    try {
      athleteContext = await prefetchAthleteContext(input.context.athleteId);
    } catch (err) {
      console.warn(
        `[coach-chat] Failed to prefetch context: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  const routeInfo = `The athlete is currently viewing: ${input.context.routeDescription}.`;

  const messages = [
    new SystemMessage(COACH_CHAT_SYSTEM_PROMPT),
    ...input.history.map((msg) =>
      msg.role === 'user'
        ? new HumanMessage(msg.text)
        : new SystemMessage(`[Previous coach response]: ${msg.text}`),
    ),
    new HumanMessage(`${routeInfo}\n\n${athleteContext}\n\nAthlete says: ${input.message}`),
  ];

  let response: AIMessage;
  try {
    response = (await model.invoke(messages)) as AIMessage;
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }

  const text = extractText(response);
  if (!text) {
    return { ok: false, error: 'Model returned an empty response' };
  }

  return { ok: true, data: { message: text, toolCallCount: 0 } };
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
