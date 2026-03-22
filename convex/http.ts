import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import type { StravaActivitySummary, StravaLap, StravaSplit } from './lib/stravaApi';
import { buildActivityArgs } from './stravaSync';

const http = httpRouter();

function validateSecret(secret: unknown): boolean {
  const expected = process.env['CONVEX_WEBHOOK_SECRET'];
  if (!expected) return false;
  return secret === expected;
}

function jsonError(msg: string, status: number): Response {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function jsonOk(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// Coerce raw Strava JSON (from n8n) into the typed StravaActivitySummary shape
// so we can reuse buildActivityArgs (shared with stravaSync).
// ---------------------------------------------------------------------------

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStravaSummary(raw: Record<string, unknown>): StravaActivitySummary {
  const summary: StravaActivitySummary = {
    id: num(raw['id']),
    name: str(raw['name'], 'Untitled'),
    sport_type: str(raw['sport_type'], str(raw['type'], 'Unknown')),
    start_date: str(raw['start_date'], new Date().toISOString()),
    start_date_local: str(raw['start_date_local'], str(raw['start_date'])),
    timezone: str(raw['timezone']),
    distance: num(raw['distance']),
    moving_time: num(raw['moving_time']),
    elapsed_time: num(raw['elapsed_time']),
    total_elevation_gain: num(raw['total_elevation_gain']),
    has_heartrate: Boolean(raw['has_heartrate']),
    average_speed: num(raw['average_speed']),
    max_speed: num(raw['max_speed']),
  };
  if (raw['average_heartrate'] != null) summary.average_heartrate = num(raw['average_heartrate']);
  if (raw['max_heartrate'] != null) summary.max_heartrate = num(raw['max_heartrate']);
  if (raw['average_cadence'] != null) summary.average_cadence = num(raw['average_cadence']);
  if (raw['average_watts'] != null) summary.average_watts = num(raw['average_watts']);
  if (raw['average_temp'] != null) summary.average_temp = num(raw['average_temp']);
  if (raw['calories'] != null) summary.calories = num(raw['calories']);
  if (raw['suffer_score'] != null) summary.suffer_score = num(raw['suffer_score']);
  if (typeof raw['gear_id'] === 'string' && raw['gear_id']) summary.gear_id = raw['gear_id'];
  if (Array.isArray(raw['splits_metric']))
    summary.splits_metric = raw['splits_metric'] as StravaSplit[];
  if (Array.isArray(raw['laps'])) summary.laps = raw['laps'] as StravaLap[];
  return summary;
}

// ---------------------------------------------------------------------------
// POST /api/pipeline/token
// Resolves athlete by Strava ID, returns valid access token + athlete info.
// ---------------------------------------------------------------------------

http.route({
  path: '/api/pipeline/token',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json()) as { stravaAthleteId?: string; secret?: string };
    if (!validateSecret(body.secret)) return jsonError('Unauthorized', 401);
    if (!body.stravaAthleteId) return jsonError('stravaAthleteId required', 400);

    try {
      const result = await ctx.runAction(internal.pipelineActions.getTokenForPipeline, {
        stravaAthleteId: body.stravaAthleteId,
      });
      return jsonOk(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(msg, 500);
    }
  }),
});

// ---------------------------------------------------------------------------
// POST /api/pipeline/activity
// Upserts a Strava activity into Convex. n8n sends raw Strava activity JSON.
// ---------------------------------------------------------------------------

http.route({
  path: '/api/pipeline/activity',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json()) as {
      secret?: string;
      athleteId?: string;
      stravaActivity?: Record<string, unknown>;
    };
    if (!validateSecret(body.secret)) return jsonError('Unauthorized', 401);
    if (!body.athleteId || !body.stravaActivity) {
      return jsonError('athleteId and stravaActivity required', 400);
    }

    const raw = body.stravaActivity;
    const activity = toStravaSummary(raw);
    const args = buildActivityArgs(body.athleteId as Id<'athletes'>, activity);

    try {
      const activityId = await ctx.runMutation(internal.activities.upsertFromStrava, {
        ...args,
        processingStatus: 'analyzing',
      });
      return jsonOk({ activityId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(msg, 500);
    }
  }),
});

// ---------------------------------------------------------------------------
// POST /api/pipeline/status
// Updates activity processingStatus.
// ---------------------------------------------------------------------------

http.route({
  path: '/api/pipeline/status',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json()) as {
      secret?: string;
      activityId?: string;
      status?: string;
      error?: string;
    };
    if (!validateSecret(body.secret)) return jsonError('Unauthorized', 401);
    if (!body.activityId || !body.status) {
      return jsonError('activityId and status required', 400);
    }

    const validStatuses = [
      'received',
      'fetching',
      'analyzing',
      'generating_audio',
      'complete',
      'error',
    ];
    if (!validStatuses.includes(body.status)) {
      return jsonError(`Invalid status: ${body.status}`, 400);
    }

    try {
      await ctx.runMutation(internal.activities.updateStatus, {
        activityId: body.activityId as Id<'activities'>,
        processingStatus: body.status as
          | 'received'
          | 'fetching'
          | 'analyzing'
          | 'generating_audio'
          | 'complete'
          | 'error',
        ...(body.error ? { processingError: body.error } : {}),
      });
      return jsonOk({ ok: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(msg, 500);
    }
  }),
});

// ---------------------------------------------------------------------------
// POST /api/pipeline/analysis
// Stores analysis + downsampled streams, sets status to complete.
// ---------------------------------------------------------------------------

http.route({
  path: '/api/pipeline/analysis',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const body = (await req.json()) as {
      secret?: string;
      activityId?: string;
      analysis?: Record<string, unknown>;
      streams?: Record<string, unknown>;
    };
    if (!validateSecret(body.secret)) return jsonError('Unauthorized', 401);
    if (!body.activityId || !body.analysis) {
      return jsonError('activityId and analysis required', 400);
    }

    const anal = body.analysis as Record<string, string | number | boolean | null | undefined>;
    const activityId = body.activityId as Id<'activities'>;

    try {
      const analysisId = await ctx.runMutation(internal.analyses.upsertForActivity, {
        activityId,
        model: anal['model'] ? String(anal['model']) : 'llama-3.3-70b-versatile',
        executiveSummary: String(anal['executiveSummary'] ?? ''),
        positives: Array.isArray(body.analysis['positives'])
          ? (body.analysis['positives'] as string[]).map(String)
          : [],
        improvements: Array.isArray(body.analysis['improvements'])
          ? (body.analysis['improvements'] as string[]).map(String)
          : [],
        ...(anal['effortScore'] != null ? { effortScore: Number(anal['effortScore']) } : {}),
        ...(body.analysis['splitAnalysis']
          ? {
              splitAnalysis: body.analysis['splitAnalysis'] as { trend: string; comment: string },
            }
          : {}),
        ...(body.analysis['nextSession']
          ? {
              nextSession: body.analysis['nextSession'] as {
                type: string;
                durationMin: number;
                intensity: string;
                description: string;
              },
            }
          : {}),
        ...(anal['voiceSummary'] ? { voiceSummary: String(anal['voiceSummary']) } : {}),
        ...(anal['weatherNote'] ? { weatherNote: String(anal['weatherNote']) } : {}),
      });

      if (body.streams) {
        const s = body.streams;
        const timeSec = s['timeSec'] as number[] | undefined;
        if (timeSec && timeSec.length > 0) {
          await ctx.runMutation(internal.activityStreams.upsertForActivity, {
            activityId,
            kind: 'downsampled',
            timeSec,
            ...(s['distanceM'] ? { distanceM: s['distanceM'] as number[] } : {}),
            ...(s['latlng'] ? { latlng: s['latlng'] as number[][] } : {}),
            ...(s['altitudeM'] ? { altitudeM: s['altitudeM'] as number[] } : {}),
            ...(s['heartrateBpm'] ? { heartrateBpm: s['heartrateBpm'] as number[] } : {}),
            ...(s['cadenceRpm'] ? { cadenceRpm: s['cadenceRpm'] as number[] } : {}),
            ...(s['watts'] ? { watts: s['watts'] as number[] } : {}),
            ...(s['velocitySmooth'] ? { velocitySmooth: s['velocitySmooth'] as number[] } : {}),
            ...(s['tempC'] ? { tempC: s['tempC'] as number[] } : {}),
            ...(s['gradeSmooth'] ? { gradeSmooth: s['gradeSmooth'] as number[] } : {}),
            ...(s['meta'] ? { meta: s['meta'] as { windowSec: number; pointCount: number } } : {}),
            ...(s['stats'] ? { stats: s['stats'] as Record<string, unknown> } : {}),
          });
        }
      }

      await ctx.runMutation(internal.activities.updateStatus, {
        activityId,
        processingStatus: 'complete',
      });

      const activity = await ctx.runQuery(internal.activities.getByDocId, { activityId });
      if (activity) {
        await ctx.runMutation(internal.weeklyAnalyses.scheduleRegeneration, {
          athleteId: activity.athleteId,
        });
      }

      return jsonOk({ analysisId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(msg, 500);
    }
  }),
});

export default http;
