import type { StructuredToolInterface } from '@langchain/core/tools';
import { tool } from '@langchain/core/tools';
import { z } from 'zod';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';

import { getConvexClient } from './convex-client';

export const getActivitySummary = tool(
  async ({ activityId }) => {
    const convex = getConvexClient();
    const activity = await convex.query(api.activities.getForAnalysis, {
      activityId: activityId as Id<'activities'>,
    });
    if (!activity) return JSON.stringify({ error: 'Activity not found' });
    return JSON.stringify(activity);
  },
  {
    name: 'getActivitySummary',
    description:
      'Retrieve the full workout summary for an activity: distance, duration, heart rate, pace, elevation, cadence, splits, and processing status.',
    schema: z.object({
      activityId: z.string().describe('The Convex activity document ID'),
    }),
  },
);

export const getDownsampledStreams = tool(
  async ({ activityId }) => {
    const convex = getConvexClient();
    const stream = await convex.query(api.activityStreams.getDownsampled, {
      activityId: activityId as Id<'activities'>,
    });
    if (!stream) return JSON.stringify({ error: 'No streams found for this activity' });

    const summary = {
      kind: stream.kind,
      pointCount: stream.timeSec.length,
      hasHeartRate: !!stream.heartrateBpm,
      hasCadence: !!stream.cadenceRpm,
      hasPower: !!stream.watts,
      hasAltitude: !!stream.altitudeM,
      hasTemperature: !!stream.tempC,
      meta: stream.meta,
      heartrateBpm: stream.heartrateBpm,
      cadenceRpm: stream.cadenceRpm,
      watts: stream.watts,
      altitudeM: stream.altitudeM,
      velocitySmooth: stream.velocitySmooth,
      timeSec: stream.timeSec,
    };
    return JSON.stringify(summary);
  },
  {
    name: 'getDownsampledStreams',
    description:
      'Retrieve downsampled time-series streams for an activity including heart rate, cadence, power, altitude, and velocity data over time.',
    schema: z.object({
      activityId: z.string().describe('The Convex activity document ID'),
    }),
  },
);

export const getAthleteProfile = tool(
  async ({ athleteId }) => {
    const convex = getConvexClient();
    const profile = await convex.query(api.athletes.getProfileForAnalysis, {
      athleteId: athleteId as Id<'athletes'>,
    });
    if (!profile) return JSON.stringify({ error: 'Athlete profile not found' });
    return JSON.stringify(profile);
  },
  {
    name: 'getAthleteProfile',
    description:
      'Retrieve the athlete profile including name, sex, weight, resting/max heart rate, training goal, and measurement preference.',
    schema: z.object({
      athleteId: z.string().describe('The Convex athlete document ID'),
    }),
  },
);

export const getHeartRateZones = tool(
  async ({ athleteId }) => {
    const convex = getConvexClient();
    const zones = await convex.query(api.athleteZones.getLatestZones, {
      athleteId: athleteId as Id<'athletes'>,
    });
    if (!zones) return JSON.stringify({ error: 'No heart rate zones found for this athlete' });
    return JSON.stringify(zones);
  },
  {
    name: 'getHeartRateZones',
    description:
      'Retrieve the latest heart rate zone boundaries for an athlete, used for zone distribution analysis.',
    schema: z.object({
      athleteId: z.string().describe('The Convex athlete document ID'),
    }),
  },
);

export const getGearInfo = tool(
  async ({ athleteId, stravaGearId }) => {
    const convex = getConvexClient();
    const gear = await convex.query(api.gear.getByStravaGearIdPublic, {
      athleteId: athleteId as Id<'athletes'>,
      stravaGearId,
    });
    if (!gear) return JSON.stringify({ error: 'Gear not found' });
    return JSON.stringify(gear);
  },
  {
    name: 'getGearInfo',
    description:
      'Retrieve gear details (shoe or bike) used for a workout, including brand, model, and total distance.',
    schema: z.object({
      athleteId: z.string().describe('The Convex athlete document ID'),
      stravaGearId: z.string().describe('The Strava gear ID string from the activity'),
    }),
  },
);

export const getRecentActivities = tool(
  async ({ athleteId, limit }) => {
    const convex = getConvexClient();
    const activities = await convex.query(api.activities.getRecentForAthlete, {
      athleteId: athleteId as Id<'athletes'>,
      ...(limit !== undefined ? { limit } : {}),
    });
    return JSON.stringify(activities);
  },
  {
    name: 'getRecentActivities',
    description:
      'Retrieve recent completed activities for an athlete to provide context on training patterns and compare with the current workout.',
    schema: z.object({
      athleteId: z.string().describe('The Convex athlete document ID'),
      limit: z
        .number()
        .optional()
        .describe('Maximum number of recent activities to return (default 5)'),
    }),
  },
);

export const getFormSnapshot = tool(
  async ({ athleteId, date }) => {
    const convex = getConvexClient();
    const snapshot = await convex.query(api.formSnapshots.getForAthleteDate, {
      athleteId: athleteId as Id<'athletes'>,
      date,
    });
    if (!snapshot) return JSON.stringify({ error: 'No form snapshot for this date' });
    return JSON.stringify(snapshot);
  },
  {
    name: 'getFormSnapshot',
    description:
      'Retrieve the training form snapshot (CTL, ATL, TSB, ACWR) for an athlete on a specific date. Use the activity start date to get form context at the time of the workout.',
    schema: z.object({
      athleteId: z.string().describe('The Convex athlete document ID'),
      date: z.string().describe('Date string in YYYY-MM-DD format'),
    }),
  },
);

export const getExistingAnalysis = tool(
  async ({ activityId }) => {
    const convex = getConvexClient();
    const analysis = await convex.query(api.analyses.getForActivity, {
      activityId: activityId as Id<'activities'>,
    });
    if (!analysis) return JSON.stringify({ error: 'No existing analysis for this activity' });
    return JSON.stringify(analysis);
  },
  {
    name: 'getExistingAnalysis',
    description:
      'Check if a previous AI analysis already exists for this activity. Useful to avoid re-analyzing or to compare with a new analysis.',
    schema: z.object({
      activityId: z.string().describe('The Convex activity document ID'),
    }),
  },
);

export const getPreviousComparableActivity = tool(
  async ({ athleteId, sportType, beforeDate }) => {
    const convex = getConvexClient();
    const activity = await convex.query(api.activities.getPreviousComparable, {
      athleteId: athleteId as Id<'athletes'>,
      sportType,
      beforeDate,
    });
    if (!activity) return JSON.stringify({ error: 'No previous comparable activity found' });
    return JSON.stringify(activity);
  },
  {
    name: 'getPreviousComparableActivity',
    description:
      'Find the most recent activity of the same sport type before a given date. Useful for comparing performance progression.',
    schema: z.object({
      athleteId: z.string().describe('The Convex athlete document ID'),
      sportType: z.string().describe('The sport type to match (e.g. "Run", "Ride")'),
      beforeDate: z.string().describe('ISO date string -- find activities before this date'),
    }),
  },
);

export function getAllWorkoutTools(): StructuredToolInterface[] {
  return [
    getActivitySummary,
    getDownsampledStreams,
    getAthleteProfile,
    getHeartRateZones,
    getGearInfo,
    getRecentActivities,
    getFormSnapshot,
    getExistingAnalysis,
    getPreviousComparableActivity,
  ];
}
