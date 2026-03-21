import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import type { ActionCtx } from './_generated/server';
import { internalAction } from './_generated/server';
import { downsampleStreams } from './lib/downsample';
import {
  StravaApiError,
  StravaRateLimitError,
  deriveActivityBucket,
  fetchActivitiesList,
  fetchActivityDetail,
  fetchActivityStreams,
  fetchAthleteZones,
  fetchGearDetail,
  refreshStravaToken,
  type StravaActivitySummary,
} from './lib/stravaApi';

const TOKEN_REFRESH_BUFFER_SEC = 300;
const BACKFILL_BATCH_DELAY_MS = 2000;
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
function buildActivityArgs(
  athleteId: Id<'athletes'>,
  activity: StravaActivitySummary,
  status: 'received' | 'fetching',
) {
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
    processingStatus: status,
  } as const;
}

// ---------------------------------------------------------------------------
// backfillHistory: one-time fetch of all historical activities after OAuth
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
          buildActivityArgs(args.athleteId, activity, 'received'),
        );
      }

      for (let i = 0; i < newActivities.length; i++) {
        const activity = newActivities[i];
        if (!activity) continue;
        await ctx.scheduler.runAfter(
          i * BACKFILL_BATCH_DELAY_MS,
          internal.stravaSync.fetchAndStoreActivity,
          { athleteId: args.athleteId, stravaActivityId: String(activity.id) },
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
// syncNewActivities: poll for new activities (called by cron)
// ---------------------------------------------------------------------------

export const syncNewActivities = internalAction({
  args: {},
  handler: async (ctx) => {
    const athletes = await ctx.runQuery(internal.athletes.listAllInternal, {});

    for (const athlete of athletes) {
      try {
        await syncAthleteActivities(ctx, athlete._id);
      } catch (err) {
        console.error(
          `Sync failed for athlete ${athlete._id}:`,
          err instanceof Error ? err.message : String(err),
        );
      }
    }
  },
});

async function syncAthleteActivities(ctx: ActionCtx, athleteId: Id<'athletes'>): Promise<void> {
  const token = await getValidAccessToken(ctx, athleteId);

  const pollState = await ctx.runQuery(internal.stravaPollState.getForAthlete, { athleteId });
  const after = pollState?.lastActivityStartTime ?? 0;

  const activities = await fetchActivitiesList(token, { after });

  const now = Math.floor(Date.now() / 1000);

  if (activities.length === 0) {
    await ctx.runMutation(internal.stravaPollState.update, {
      athleteId,
      lastActivityStartTime: after,
      lastPollAt: now,
    });
    return;
  }

  const existingIds = new Set(
    await ctx.runQuery(internal.activities.listStravaIdsForAthlete, { athleteId }),
  );

  let maxStartEpoch = after;
  let newCount = 0;

  for (const activity of activities) {
    const startEpoch = Math.floor(new Date(activity.start_date).getTime() / 1000);
    if (startEpoch > maxStartEpoch) maxStartEpoch = startEpoch;

    if (existingIds.has(String(activity.id))) continue;

    await ctx.runMutation(
      internal.activities.upsertFromStrava,
      buildActivityArgs(athleteId, activity, 'received'),
    );

    await ctx.scheduler.runAfter(0, internal.stravaSync.fetchAndStoreActivity, {
      athleteId,
      stravaActivityId: String(activity.id),
    });
    newCount++;
  }

  await ctx.runMutation(internal.stravaPollState.update, {
    athleteId,
    lastActivityStartTime: maxStartEpoch,
    lastPollAt: now,
  });

  if (newCount > 0) {
    console.log(`Synced ${String(newCount)} new activities for ${athleteId}`);
  }
}

// ---------------------------------------------------------------------------
// fetchAndStoreActivity: fetch full detail + streams for one activity
// ---------------------------------------------------------------------------

export const fetchAndStoreActivity = internalAction({
  args: {
    athleteId: v.id('athletes'),
    stravaActivityId: v.string(),
  },
  handler: async (ctx, args) => {
    const activityDoc = await ctx.runQuery(internal.activities.getByStravaId, {
      stravaActivityId: args.stravaActivityId,
    });

    if (!activityDoc) {
      console.error(`Activity ${args.stravaActivityId} not found in DB, skipping`);
      return;
    }

    if (
      activityDoc.processingStatus === 'complete' ||
      activityDoc.processingStatus === 'analyzing'
    ) {
      return;
    }

    await ctx.runMutation(internal.activities.updateStatus, {
      activityId: activityDoc._id,
      processingStatus: 'fetching',
    });

    let token: string;
    try {
      token = await getValidAccessToken(ctx, args.athleteId);
    } catch (err) {
      await ctx.runMutation(internal.activities.updateStatus, {
        activityId: activityDoc._id,
        processingStatus: 'error',
        processingError: `Token error: ${err instanceof Error ? err.message : String(err)}`,
      });
      return;
    }

    try {
      // 1. Fetch full activity detail
      const detail = await fetchActivityDetail(token, args.stravaActivityId);

      await ctx.runMutation(
        internal.activities.upsertFromStrava,
        buildActivityArgs(args.athleteId, detail, 'fetching'),
      );

      // 2. Fetch + downsample streams
      try {
        const streams = await fetchActivityStreams(token, args.stravaActivityId);
        const downsampled = downsampleStreams(streams);

        if (downsampled) {
          await ctx.runMutation(internal.activityStreams.upsertForActivity, {
            activityId: activityDoc._id,
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
        }
      } catch (streamErr) {
        console.warn(
          `Streams unavailable for ${args.stravaActivityId}:`,
          streamErr instanceof Error ? streamErr.message : String(streamErr),
        );
      }

      // 3. Zones (cached 7 days)
      const cachedZones = await ctx.runQuery(internal.athleteZones.getLatest, {
        athleteId: args.athleteId,
      });
      if (!cachedZones) {
        try {
          const zones = await fetchAthleteZones(token);
          const hrZones = zones.heart_rate?.zones.map((z) => ({ min: z.min, max: z.max }));
          await ctx.runMutation(internal.athleteZones.upsertForAthlete, {
            athleteId: args.athleteId,
            ...(hrZones ? { heartRateZones: hrZones } : {}),
          });
        } catch (zoneErr) {
          console.warn(
            `Zones fetch failed for ${args.athleteId}:`,
            zoneErr instanceof Error ? zoneErr.message : String(zoneErr),
          );
        }
      }

      // 4. Gear (conditional)
      if (detail.gear_id) {
        try {
          const gearDetail = await fetchGearDetail(token, detail.gear_id);
          await ctx.runMutation(internal.gear.upsertFromStrava, {
            athleteId: args.athleteId,
            stravaGearId: gearDetail.id,
            name: gearDetail.name,
            distanceMeters: gearDetail.distance,
            ...(gearDetail.brand_name ? { brandName: gearDetail.brand_name } : {}),
            ...(gearDetail.model_name ? { modelName: gearDetail.model_name } : {}),
            gearType: inferGearType(gearDetail.id),
            ...(gearDetail.retired !== undefined ? { retired: gearDetail.retired } : {}),
          });
        } catch (gearErr) {
          console.warn(
            `Gear fetch failed for ${detail.gear_id}:`,
            gearErr instanceof Error ? gearErr.message : String(gearErr),
          );
        }
      }

      // 5. Mark complete
      await ctx.runMutation(internal.activities.updateStatus, {
        activityId: activityDoc._id,
        processingStatus: 'complete',
      });
    } catch (err) {
      if (err instanceof StravaRateLimitError) {
        console.warn(
          `Rate limited on ${args.stravaActivityId}, rescheduling in ${String(err.retryAfterSec)}s`,
        );
        await ctx.runMutation(internal.activities.updateStatus, {
          activityId: activityDoc._id,
          processingStatus: 'received',
        });
        await ctx.scheduler.runAfter(
          err.retryAfterSec * 1000,
          internal.stravaSync.fetchAndStoreActivity,
          { athleteId: args.athleteId, stravaActivityId: args.stravaActivityId },
        );
        return;
      }

      const message =
        err instanceof StravaApiError && err.status === 404
          ? 'strava_404_deleted'
          : err instanceof Error
            ? err.message
            : String(err);

      await ctx.runMutation(internal.activities.updateStatus, {
        activityId: activityDoc._id,
        processingStatus: 'error',
        processingError: message,
      });
      console.error(`Error fetching activity ${args.stravaActivityId}: ${message}`);
    }
  },
});

function inferGearType(gearId: string): 'shoe' | 'bike' | 'other' {
  if (gearId.startsWith('b')) return 'bike';
  if (gearId.startsWith('g')) return 'shoe';
  return 'other';
}
