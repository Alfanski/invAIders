import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import { action, internalAction } from './_generated/server';
import { downsampleStreams } from './lib/downsample';
import {
  StravaApiError,
  StravaRateLimitError,
  deriveActivityBucket,
  fetchActivitiesList,
  fetchActivityStreams,
  fetchAthleteZones,
  refreshStravaToken,
  type StravaActivitySummary,
} from './lib/stravaApi';
import { buildDailyTrimps, projectFormSeries } from './lib/formMetrics';
import { computeStreamStats } from './lib/streamStats';
import { computeActivityTrimp } from './lib/trimp';

const TOKEN_REFRESH_BUFFER_SEC = 300;
const MAX_BACKFILL_PAGES = 5;

// ---------------------------------------------------------------------------
// Token refresh helper
// ---------------------------------------------------------------------------

async function getValidAccessToken(ctx: ActionCtx, athleteId: Id<'athletes'>): Promise<string> {
  const tokenDoc = await ctx.runQuery(internal.stravaTokens.getForAthlete, { athleteId });
  if (!tokenDoc) throw new Error(`No Strava tokens found for athlete ${athleteId}`);

  const now = Math.floor(Date.now() / 1000);
  if (tokenDoc.expiresAt > now + TOKEN_REFRESH_BUFFER_SEC) {
    return tokenDoc.accessToken;
  }

  const clientId = process.env['STRAVA_CLIENT_ID'];
  const clientSecret = process.env['STRAVA_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in Convex env vars');
  }

  const refreshed = await refreshStravaToken(clientId, clientSecret, tokenDoc.refreshToken);

  await ctx.runMutation(internal.stravaTokens.upsertConnection, {
    athleteId,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: refreshed.expires_at,
  });

  return refreshed.access_token;
}

// ---------------------------------------------------------------------------
// Helper: build upsert args from a Strava activity summary
// ---------------------------------------------------------------------------

interface AthleteProfile {
  sex?: 'M' | 'F';
  restingHr?: number;
  maxHr?: number;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildActivityArgs(
  athleteId: Id<'athletes'>,
  activity: StravaActivitySummary,
  athlete: AthleteProfile = {},
) {
  const bucket = deriveActivityBucket(activity.sport_type);

  const trimp = computeActivityTrimp(
    {
      movingTimeSec: activity.moving_time,
      ...(activity.average_heartrate != null
        ? { averageHeartrate: activity.average_heartrate }
        : {}),
      ...(activity.max_heartrate != null ? { maxHeartrate: activity.max_heartrate } : {}),
      sportType: activity.sport_type,
      distanceMeters: activity.distance,
      totalElevationGainM: activity.total_elevation_gain,
      ...(activity.suffer_score != null ? { sufferScore: activity.suffer_score } : {}),
    },
    athlete,
  );

  return {
    athleteId,
    stravaActivityId: String(activity.id),
    name: activity.name,
    sportType: activity.sport_type,
    activityBucket: bucket,
    startDate: activity.start_date,
    startDateLocal: activity.start_date_local,
    timezone: activity.timezone,
    distanceMeters: activity.distance,
    movingTimeSec: activity.moving_time,
    elapsedTimeSec: activity.elapsed_time,
    totalElevationGainM: activity.total_elevation_gain,
    hasHeartrate: activity.has_heartrate,
    ...(activity.average_heartrate !== undefined
      ? { averageHeartrate: activity.average_heartrate }
      : {}),
    ...(activity.max_heartrate !== undefined ? { maxHeartrate: activity.max_heartrate } : {}),
    averageSpeed: activity.average_speed,
    maxSpeed: activity.max_speed,
    ...(activity.average_cadence !== undefined ? { averageCadence: activity.average_cadence } : {}),
    ...(activity.average_watts !== undefined ? { averageWatts: activity.average_watts } : {}),
    ...(activity.average_temp !== undefined ? { averageTempC: activity.average_temp } : {}),
    ...(activity.calories !== undefined ? { calories: activity.calories } : {}),
    ...(activity.suffer_score !== undefined ? { sufferScore: activity.suffer_score } : {}),
    ...(activity.gear_id ? { stravaGearId: activity.gear_id } : {}),
    ...(activity.splits_metric ? { splitsMetric: activity.splits_metric } : {}),
    ...(activity.laps ? { laps: activity.laps } : {}),
    trimp,
    processingStatus: 'received' as const,
  };
}

// ---------------------------------------------------------------------------
// backfillHistory: one-time list-only fetch after OAuth
// API cost: 1-5 calls (one per page of 200 activities)
// ---------------------------------------------------------------------------

export const backfillHistory = internalAction({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const status = await ctx.runQuery(internal.athletes.getBackfillStatus, {
      athleteId: args.athleteId,
    });
    if (status === 'complete' || status === 'running') {
      console.log(`Backfill already ${status} for ${args.athleteId}, skipping`);
      return;
    }

    await ctx.runMutation(internal.athletes.updateBackfillStatus, {
      athleteId: args.athleteId,
      status: 'running',
    });

    try {
      const token = await getValidAccessToken(ctx, args.athleteId);

      const athlete = await ctx.runQuery(internal.athletes.getById, {
        athleteId: args.athleteId,
      });
      const athleteProfile: AthleteProfile = {
        ...(athlete?.sex ? { sex: athlete.sex } : {}),
        ...(athlete?.restingHr != null ? { restingHr: athlete.restingHr } : {}),
        ...(athlete?.maxHr != null ? { maxHr: athlete.maxHr } : {}),
      };

      const allActivities: StravaActivitySummary[] = [];
      for (let page = 1; page <= MAX_BACKFILL_PAGES; page++) {
        const batch = await fetchActivitiesList(token, { page, perPage: 200 });
        allActivities.push(...batch);
        if (batch.length < 200) break;
      }

      if (allActivities.length === 0) {
        console.log(`No activities found for athlete ${args.athleteId}`);
        await ctx.runMutation(internal.athletes.updateBackfillStatus, {
          athleteId: args.athleteId,
          status: 'complete',
        });
        return;
      }

      const existingIds = new Set(
        await ctx.runQuery(internal.activities.listStravaIdsForAthlete, {
          athleteId: args.athleteId,
        }),
      );

      const newActivities = allActivities.filter((a) => !existingIds.has(String(a.id)));

      let maxStartEpoch = 0;
      for (const activity of allActivities) {
        const startEpoch = Math.floor(new Date(activity.start_date).getTime() / 1000);
        if (startEpoch > maxStartEpoch) maxStartEpoch = startEpoch;
      }

      const insertedActivityIds: Id<'activities'>[] = [];
      for (const activity of newActivities) {
        const activityId = await ctx.runMutation(
          internal.activities.upsertFromStrava,
          buildActivityArgs(args.athleteId, activity, athleteProfile),
        );
        insertedActivityIds.push(activityId);
      }

      await ctx.runMutation(internal.stravaPollState.update, {
        athleteId: args.athleteId,
        lastActivityStartTime: maxStartEpoch,
        lastPollAt: Math.floor(Date.now() / 1000),
      });

      // Fetch athlete HR zones (1 API call, cached 7 days)
      try {
        const existingZones = await ctx.runQuery(internal.athleteZones.getLatest, {
          athleteId: args.athleteId,
        });
        if (!existingZones) {
          const zonesData = await fetchAthleteZones(token);
          await ctx.runMutation(internal.athleteZones.upsertForAthlete, {
            athleteId: args.athleteId,
            ...(zonesData.heart_rate?.zones ? { heartRateZones: zonesData.heart_rate.zones } : {}),
          });
          console.log(`Fetched HR zones for athlete ${args.athleteId}`);
        }
      } catch (zoneErr) {
        console.warn(
          'Failed to fetch athlete zones:',
          zoneErr instanceof Error ? zoneErr.message : String(zoneErr),
        );
      }

      // Schedule form snapshot computation after backfill
      await ctx.scheduler.runAfter(0, internal.stravaSync.computeFormSnapshots, {
        athleteId: args.athleteId,
      });

      // Per-workout AI analysis is handled by the n8n pipeline (triggered via webhook).
      // No need to schedule triggerWorkoutAnalysis here.

      await ctx.runMutation(internal.athletes.updateBackfillStatus, {
        athleteId: args.athleteId,
        status: 'complete',
      });

      console.log(
        `Backfill: ${String(insertedActivityIds.length)} new of ${String(allActivities.length)} total for ${args.athleteId}`,
      );
    } catch (err) {
      await ctx.runMutation(internal.athletes.updateBackfillStatus, {
        athleteId: args.athleteId,
        status: 'error',
      });
      throw err;
    }
  },
});

// ---------------------------------------------------------------------------
// computeFormSnapshots: Compute CTL/ATL/TSB series and persist to formSnapshots.
// Scheduled after backfill completes or on demand.
// ---------------------------------------------------------------------------

export const computeFormSnapshots = internalAction({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const activities = await ctx.runQuery(internal.activities.listAll, {
      athleteId: args.athleteId,
    });

    if (activities.length === 0) {
      console.log(`No activities for form computation: ${args.athleteId}`);
      return;
    }

    const dailyTrimps = buildDailyTrimps(
      activities.map((a: { startDate: string; trimp?: number; movingTimeSec: number }) => ({
        startDate: a.startDate,
        ...(a.trimp != null ? { trimp: a.trimp } : {}),
        movingTimeSec: a.movingTimeSec,
      })),
    );

    if (dailyTrimps.length === 0) return;

    const series = projectFormSeries(dailyTrimps);

    for (const snap of series) {
      await ctx.runMutation(internal.formSnapshots.upsertDay, {
        athleteId: args.athleteId,
        date: snap.date,
        ctl: snap.ctl,
        atl: snap.atl,
        tsb: snap.tsb,
        acwr: snap.acwr,
        dailyTrimp: snap.dailyTrimp,
      });
    }

    console.log(`Computed ${String(series.length)} form snapshots for athlete ${args.athleteId}`);
  },
});

// ---------------------------------------------------------------------------
// pollNewActivities: incremental fetch of activities since last known
// Runs on a cron schedule. API cost: 1 call per athlete (typically).
// ---------------------------------------------------------------------------

export const pollNewActivities = internalAction({
  args: {},
  handler: async (ctx) => {
    const athletes = await ctx.runQuery(internal.athletes.listAllInternal, {});
    if (athletes.length === 0) return;

    for (const athlete of athletes) {
      if (athlete.formBackfillStatus !== 'complete') continue;

      try {
        const rateLimited = await pollForAthlete(ctx, athlete._id);
        if (rateLimited) {
          console.warn('Strava rate limit hit, stopping poll cycle early');
          break;
        }
      } catch (err) {
        console.error(
          `Poll failed for athlete ${athlete._id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  },
});

/** Returns true if rate-limited (caller should stop polling other athletes). */
async function pollForAthlete(ctx: ActionCtx, athleteId: Id<'athletes'>): Promise<boolean> {
  const pollState = await ctx.runQuery(internal.stravaPollState.getForAthlete, { athleteId });
  const after = pollState?.lastActivityStartTime ?? 0;

  let token: string;
  try {
    token = await getValidAccessToken(ctx, athleteId);
  } catch {
    console.warn(`Skipping poll for ${athleteId}: token error`);
    return false;
  }

  let activities: StravaActivitySummary[];
  try {
    activities = await fetchActivitiesList(token, { after, perPage: 200 });
  } catch (err) {
    if (err instanceof StravaRateLimitError) return true;
    throw err;
  }

  if (activities.length === 0) return false;

  const existingIds = new Set(
    await ctx.runQuery(internal.activities.listStravaIdsForAthlete, { athleteId }),
  );

  const athlete = await ctx.runQuery(internal.athletes.getById, { athleteId });
  const athleteProfile: AthleteProfile = {
    ...(athlete?.sex ? { sex: athlete.sex } : {}),
    ...(athlete?.restingHr != null ? { restingHr: athlete.restingHr } : {}),
    ...(athlete?.maxHr != null ? { maxHr: athlete.maxHr } : {}),
  };

  let maxStartEpoch = after;
  const insertedActivityIds: Id<'activities'>[] = [];

  for (const activity of activities) {
    if (existingIds.has(String(activity.id))) continue;

    const activityId = await ctx.runMutation(
      internal.activities.upsertFromStrava,
      buildActivityArgs(athleteId, activity, athleteProfile),
    );
    insertedActivityIds.push(activityId);

    const startEpoch = Math.floor(new Date(activity.start_date).getTime() / 1000);
    if (startEpoch > maxStartEpoch) maxStartEpoch = startEpoch;
  }

  await ctx.runMutation(internal.stravaPollState.update, {
    athleteId,
    lastActivityStartTime: maxStartEpoch,
    lastPollAt: Math.floor(Date.now() / 1000),
  });

  if (insertedActivityIds.length > 0) {
    console.log(
      `Poll: inserted ${String(insertedActivityIds.length)} new activities for ${athleteId}`,
    );
    await ctx.scheduler.runAfter(0, internal.stravaSync.computeFormSnapshots, { athleteId });

    // Per-workout AI analysis is handled by the n8n pipeline (triggered via webhook).
    // No need to schedule triggerWorkoutAnalysis here.
  }

  return false;
}

// ---------------------------------------------------------------------------
// fetchStreamsOnDemand: fetch + downsample streams for a single activity
// Called when user views a workout that has no streams yet.
// API cost: 1 call
// ---------------------------------------------------------------------------

export const fetchStreamsOnDemand = action({
  args: {
    athleteId: v.id('athletes'),
    activityId: v.id('activities'),
    stravaActivityId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.runQuery(api.activityStreams.getDownsampledForActivity, {
      activityId: args.activityId,
    });
    if (existing) return { status: 'already_loaded' as const };

    let token: string;
    try {
      token = await getValidAccessToken(ctx, args.athleteId);
    } catch {
      return { status: 'token_error' as const };
    }

    try {
      const streams = await fetchActivityStreams(token, args.stravaActivityId);
      const downsampled = downsampleStreams(streams);

      if (downsampled) {
        const stats = computeStreamStats(downsampled);
        await ctx.runMutation(internal.activityStreams.upsertForActivity, {
          activityId: args.activityId,
          kind: 'downsampled',
          timeSec: downsampled.timeSec,
          ...(downsampled.distanceM ? { distanceM: downsampled.distanceM } : {}),
          ...(downsampled.latlng ? { latlng: downsampled.latlng } : {}),
          ...(downsampled.altitudeM ? { altitudeM: downsampled.altitudeM } : {}),
          ...(downsampled.heartrateBpm ? { heartrateBpm: downsampled.heartrateBpm } : {}),
          ...(downsampled.cadenceRpm ? { cadenceRpm: downsampled.cadenceRpm } : {}),
          ...(downsampled.watts ? { watts: downsampled.watts } : {}),
          ...(downsampled.velocitySmooth ? { velocitySmooth: downsampled.velocitySmooth } : {}),
          ...(downsampled.tempC ? { tempC: downsampled.tempC } : {}),
          ...(downsampled.gradeSmooth ? { gradeSmooth: downsampled.gradeSmooth } : {}),
          meta: downsampled.meta,
          stats,
        });
        return { status: 'loaded' as const };
      }

      return { status: 'no_streams' as const };
    } catch (err) {
      if (err instanceof StravaRateLimitError) {
        return { status: 'rate_limited' as const };
      }
      if (err instanceof StravaApiError && err.status === 404) {
        return { status: 'not_found' as const };
      }
      console.warn(
        `Stream fetch failed for ${args.stravaActivityId}:`,
        err instanceof Error ? err.message : String(err),
      );
      return { status: 'error' as const };
    }
  },
});
