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

function getConvexSiteUrl(): string {
  const siteUrl = process.env['CONVEX_SITE_URL'];
  if (siteUrl) return siteUrl;
  const deployUrl = process.env['CONVEX_URL'] ?? process.env['NEXT_PUBLIC_CONVEX_URL'];
  if (!deployUrl) throw new Error('CONVEX_SITE_URL or CONVEX_URL must be set');
  return deployUrl.replace('.cloud', '.site');
}

async function setActivityStatus(
  activityId: Id<'activities'>,
  status: 'analyzing' | 'complete' | 'error',
  error?: string,
): Promise<void> {
  try {
    const siteUrl = getConvexSiteUrl();
    const secret = process.env['CONVEX_WEBHOOK_SECRET'];
    const res = await fetch(`${siteUrl}/api/pipeline/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        activityId,
        status,
        ...(error ? { error: error.slice(0, 500) } : {}),
      }),
    });
    if (!res.ok) {
      console.warn(`[analyze-workout] Status update returned ${String(res.status)}`);
    }
  } catch (err) {
    console.warn(
      `[analyze-workout] Failed to set status=${status}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const internalToken = process.env['INTERNAL_API_TOKEN'];
  if (!internalToken) {
    console.error('[analyze-workout] INTERNAL_API_TOKEN is not configured');
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
  }
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${internalToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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

  await setActivityStatus(typedActivityId, 'analyzing');

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

    await setActivityStatus(typedActivityId, 'error', `${errorCode}: ${result.error.message}`);

    return NextResponse.json(
      { error: errorCode, message: result.error.message, phase: result.error.phase },
      { status: 500 },
    );
  }

  console.log(
    `[analyze-workout] Analysis complete: toolCalls=${String(result.data.toolCallCount)} rounds=${String(result.data.rounds)} effort=${String(result.data.analysis.effortScore)}`,
  );

  try {
    const siteUrl = getConvexSiteUrl();
    const secret = process.env['CONVEX_WEBHOOK_SECRET'];
    const saveResponse = await fetch(`${siteUrl}/api/internal/save-analysis`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
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
      }),
    });

    if (!saveResponse.ok) {
      const errText = await saveResponse.text();
      throw new Error(`Save endpoint returned ${String(saveResponse.status)}: ${errText}`);
    }

    const saveResult = (await saveResponse.json()) as { analysisId: string };
    await setActivityStatus(typedActivityId, 'complete');

    return NextResponse.json({
      status: 'ok',
      analysisId: saveResult.analysisId,
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
      typedActivityId,
      'error',
      `save_failed: ${err instanceof Error ? err.message : String(err)}`.slice(0, 500),
    );
    return NextResponse.json(
      {
        error: 'save_failed',
        message: 'Analysis generated but failed to persist',
      },
      { status: 500 },
    );
  }
}
