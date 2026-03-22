import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { runWorkoutAgent } from '@/lib/ai/langchain/runWorkoutAgent';
import type { AgentErrorCode } from '@/lib/ai/langchain/runWorkoutAgent';

export const maxDuration = 120;

interface AnalyzeRequestBody {
  activityId: string;
  athleteId?: string;
}

function getConvexClient(): ConvexHttpClient {
  const url = process.env['CONVEX_URL'];
  if (!url) throw new Error('CONVEX_URL is not set');
  return new ConvexHttpClient(url);
}

async function setActivityStatus(
  convex: ConvexHttpClient,
  activityId: Id<'activities'>,
  status: 'analyzing' | 'complete' | 'error',
  error?: string,
): Promise<void> {
  try {
    await convex.action(api.analyses.setProcessingStatus, {
      activityId,
      processingStatus: status,
      ...(error ? { processingError: error.slice(0, 500) } : {}),
    });
  } catch (err) {
    console.warn(
      `[analyze-workout] Failed to set status=${status}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const internalToken = process.env['INTERNAL_API_TOKEN'];
  if (internalToken) {
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${internalToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  let body: AnalyzeRequestBody;
  try {
    body = (await request.json()) as AnalyzeRequestBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { activityId } = body;
  if (!activityId) {
    return NextResponse.json({ error: 'activityId is required' }, { status: 400 });
  }

  const convex = getConvexClient();
  const typedActivityId = activityId as Id<'activities'>;

  await setActivityStatus(convex, typedActivityId, 'analyzing');

  let athleteName: string | undefined;
  let athleteGoal: string | undefined;

  if (body.athleteId) {
    try {
      const profile = await convex.query(api.athletes.getProfileForAnalysis, {
        athleteId: body.athleteId as Id<'athletes'>,
      });
      if (profile) {
        athleteName = profile.firstName ?? undefined;
        athleteGoal = profile.goalText ?? undefined;
      }
    } catch {
      console.warn('[analyze-workout] Could not fetch athlete profile');
    }
  }

  console.log(
    `[analyze-workout] Starting analysis for activity=${activityId} athlete=${body.athleteId ?? 'unknown'}`,
  );

  const result = await runWorkoutAgent({
    activityId,
    athleteName,
    athleteGoal,
  });

  if (!result.ok) {
    const errorCode: AgentErrorCode = result.error.code;
    console.error(
      `[analyze-workout] Agent error: code=${errorCode} phase=${result.error.phase} msg=${result.error.message}`,
    );

    await setActivityStatus(
      convex,
      typedActivityId,
      'error',
      `${errorCode}: ${result.error.message}`,
    );

    return NextResponse.json(
      { error: errorCode, message: result.error.message, phase: result.error.phase },
      { status: 500 },
    );
  }

  console.log(
    `[analyze-workout] Analysis complete: toolCalls=${String(result.data.toolCallCount)} rounds=${String(result.data.rounds)} effort=${String(result.data.analysis.effortScore)}`,
  );

  try {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const saveResult = await convex.action(api['analyses']['saveFromAgent'], {
      activityId: typedActivityId,
      model: 'llama-3.3-70b-versatile',
      effortScore: result.data.analysis.effortScore,
      executiveSummary: result.data.analysis.executiveSummary,
      positives: result.data.analysis.positives,
      improvements: result.data.analysis.improvements,
      ...(result.data.analysis.hrZoneAnalysis
        ? { hrZoneAnalysis: result.data.analysis.hrZoneAnalysis }
        : {}),
      ...(result.data.analysis.splitAnalysis
        ? { splitAnalysis: result.data.analysis.splitAnalysis }
        : {}),
      ...(result.data.analysis.nextSession
        ? { nextSession: result.data.analysis.nextSession }
        : {}),
      ...(result.data.analysis.weatherNote
        ? { weatherNote: result.data.analysis.weatherNote }
        : {}),
      ...(result.data.analysis.voiceSummary
        ? { voiceSummary: result.data.analysis.voiceSummary }
        : {}),
    });

    await setActivityStatus(convex, typedActivityId, 'complete');

    return NextResponse.json({
      status: 'ok',
      analysisId: (saveResult as { analysisId: string }).analysisId,
      analysis: result.data.analysis,
      meta: {
        toolCalls: result.data.toolCallCount,
        rounds: result.data.rounds,
        model: 'llama-3.3-70b-versatile',
      },
    });
  } catch (err) {
    console.error('[analyze-workout] Failed to save analysis:', err);
    await setActivityStatus(
      convex,
      typedActivityId,
      'error',
      `save_failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500),
    );
    return NextResponse.json(
      {
        error: 'save_failed',
        message: 'Analysis generated but failed to persist',
        analysis: result.data.analysis,
      },
      { status: 500 },
    );
  }
}
