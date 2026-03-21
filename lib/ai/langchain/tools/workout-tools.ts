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

export function getAllWorkoutTools(): StructuredToolInterface[] {
  return [
    getActivitySummary,
    getDownsampledStreams,
    getAthleteProfile,
    getHeartRateZones,
    getGearInfo,
    getRecentActivities,
  ];
}
