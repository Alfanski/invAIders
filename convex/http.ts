import { httpRouter } from 'convex/server';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { httpAction } from './_generated/server';
import { deriveActivityBucket } from './lib/stravaApi';

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

    const a = body.stravaActivity;
    const sportType = String(a['sport_type'] ?? a['type'] ?? 'Unknown');

    try {
      const activityId = await ctx.runMutation(internal.activities.upsertFromStrava, {
        athleteId: body.athleteId as Id<'athletes'>,
        stravaActivityId: String(a['id']),
        name: String(a['name'] ?? 'Untitled'),
        sportType,
        activityBucket: deriveActivityBucket(sportType),
        startDate: String(a['start_date'] ?? new Date().toISOString()),
        startDateLocal: a['start_date_local'] ? String(a['start_date_local']) : undefined,
        timezone: a['timezone'] ? String(a['timezone']) : undefined,
        distanceMeters: Number(a['distance'] ?? 0),
        movingTimeSec: Number(a['moving_time'] ?? 0),
        elapsedTimeSec: Number(a['elapsed_time'] ?? 0),
        totalElevationGainM:
          a['total_elevation_gain'] != null ? Number(a['total_elevation_gain']) : undefined,
        hasHeartrate: a['has_heartrate'] != null ? Boolean(a['has_heartrate']) : undefined,
        averageHeartrate:
          a['average_heartrate'] != null ? Number(a['average_heartrate']) : undefined,
        maxHeartrate: a['max_heartrate'] != null ? Number(a['max_heartrate']) : undefined,
        averageSpeed: a['average_speed'] != null ? Number(a['average_speed']) : undefined,
        maxSpeed: a['max_speed'] != null ? Number(a['max_speed']) : undefined,
        averageCadence: a['average_cadence'] != null ? Number(a['average_cadence']) : undefined,
        averageWatts: a['average_watts'] != null ? Number(a['average_watts']) : undefined,
        averageTempC: a['average_temp'] != null ? Number(a['average_temp']) : undefined,
        calories: a['calories'] != null ? Number(a['calories']) : undefined,
        sufferScore: a['suffer_score'] != null ? Number(a['suffer_score']) : undefined,
        stravaGearId: a['gear_id'] ? String(a['gear_id']) : undefined,
        splitsMetric: a['splits_metric'] ?? undefined,
        laps: a['laps'] ?? undefined,
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

    const anal = body.analysis;
    const activityId = body.activityId as Id<'activities'>;

    try {
      const analysisId = await ctx.runMutation(internal.analyses.upsertForActivity, {
        activityId,
        model: anal['model'] ? String(anal['model']) : 'gemini-2.0-flash',
        effortScore: anal['effortScore'] != null ? Number(anal['effortScore']) : undefined,
        executiveSummary: String(anal['executiveSummary'] ?? ''),
        positives: Array.isArray(anal['positives'])
          ? (anal['positives'] as string[]).map(String)
          : [],
        improvements: Array.isArray(anal['improvements'])
          ? (anal['improvements'] as string[]).map(String)
          : [],
        ...(anal['splitAnalysis']
          ? {
              splitAnalysis: anal['splitAnalysis'] as { trend: string; comment: string },
            }
          : {}),
        ...(anal['nextSession']
          ? {
              nextSession: anal['nextSession'] as {
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

      return jsonOk({ analysisId });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return jsonError(msg, 500);
    }
  }),
});

export default http;
