import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { runCoachChat } from '@/lib/ai/langchain/runCoachChat';
import type { ChatMessage } from '@/lib/ai/langchain/runCoachChat';
import { verifySessionToken } from '@/lib/session';
import { SESSION_COOKIE_NAME } from '@/lib/strava/constants';

export const maxDuration = 60;

interface ChatRequestBody {
  message: string;
  history?: ChatMessage[];
  context?: {
    route: string;
    routeDescription: string;
    activityId?: string;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = sessionCookie ? verifySessionToken(sessionCookie) : null;

  if (!session) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { message } = body;
  if (!message.trim()) {
    return NextResponse.json({ error: 'message is required' }, { status: 400 });
  }

  const history = body.history ?? [];
  const context = {
    route: body.context?.route ?? '/dashboard',
    routeDescription: body.context?.routeDescription ?? 'the dashboard',
    athleteId: session.athleteId,
    activityId: body.context?.activityId,
  };

  console.log(
    `[coach-chat] message="${message.slice(0, 80)}" historyLen=${String(history.length)} route=${context.route} athlete=${session.athleteId}`,
  );

  const result = await runCoachChat({
    message,
    history,
    context,
  });

  if (!result.ok) {
    console.error(`[coach-chat] Agent error: ${result.error}`);
    return NextResponse.json({ error: 'coach_error', message: result.error }, { status: 500 });
  }

  console.log(
    `[coach-chat] Response generated: toolCalls=${String(result.data.toolCallCount)} len=${String(result.data.message.length)}`,
  );

  return NextResponse.json({
    message: result.data.message,
    toolCallCount: result.data.toolCallCount,
  });
}
