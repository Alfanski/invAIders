import { ConvexHttpClient } from 'convex/browser';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { runWorkoutAgent } from '@/lib/ai/langchain/runWorkoutAgent';

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
    console.error(`[analyze-workout] Agent error: ${result.error.message} (${result.error.phase})`);
    return NextResponse.json(
      { error: 'analysis_failed', message: result.error.message },
      { status: 500 },
    );
  }

  console.log(
    `[analyze-workout] Analysis complete: toolCalls=${String(result.data.toolCallCount)} rounds=${String(result.data.rounds)} effort=${String(result.data.analysis.effortScore)}`,
  );

  try {
    // eslint-disable-next-line @typescript-eslint/dot-notation
    const saveResult = await convex.action(api['analyses']['saveFromAgent'], {
      activityId: activityId as Id<'activities'>,
      model: 'gemini-2.5-flash',
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

    return NextResponse.json({
      status: 'ok',
      analysisId: (saveResult as { analysisId: string }).analysisId,
      analysis: result.data.analysis,
    });
  } catch (err) {
    console.error('[analyze-workout] Failed to save analysis:', err);
    return NextResponse.json({
      status: 'ok',
      analysisId: null,
      analysis: result.data.analysis,
      warning: 'Analysis generated but failed to persist',
    });
  }
}
