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
  refreshStravaToken,
  type StravaActivitySummary,
} from './lib/stravaApi';

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

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function buildActivityArgs(athleteId: Id<'athletes'>, activity: StravaActivitySummary) {
  const bucket = deriveActivityBucket(activity.sport_type);

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
    processingStatus: 'complete' as const,
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

      for (const activity of newActivities) {
        await ctx.runMutation(
          internal.activities.upsertFromStrava,
          buildActivityArgs(args.athleteId, activity),
        );
      }

      await ctx.runMutation(internal.stravaPollState.update, {
        athleteId: args.athleteId,
        lastActivityStartTime: maxStartEpoch,
        lastPollAt: Math.floor(Date.now() / 1000),
      });

      await ctx.runMutation(internal.athletes.updateBackfillStatus, {
        athleteId: args.athleteId,
        status: 'complete',
      });

      console.log(
        `Backfill: ${String(newActivities.length)} new of ${String(allActivities.length)} total for ${args.athleteId}`,
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
