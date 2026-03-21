import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const processingStatus = v.union(
  v.literal('received'),
  v.literal('fetching'),
  v.literal('analyzing'),
  v.literal('generating_audio'),
  v.literal('complete'),
  v.literal('error'),
);

export default defineSchema({
  activities: defineTable({
    athleteId: v.string(),
    stravaActivityId: v.string(),
    name: v.string(),
    startDate: v.string(),
    processingStatus,
    distanceMeters: v.number(),
    movingTimeSec: v.number(),
    averageHeartrate: v.optional(v.number()),
    averageSpeed: v.optional(v.number()),
    totalElevationGainM: v.optional(v.number()),
    trimp: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_athlete_start', ['athleteId', 'startDate'])
    .index('by_strava_activity_id', ['stravaActivityId']),
});
