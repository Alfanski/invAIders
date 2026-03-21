import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';

const processingStatusValidator = v.union(
  v.literal('received'),
  v.literal('fetching'),
  v.literal('analyzing'),
  v.literal('generating_audio'),
  v.literal('complete'),
  v.literal('error'),
);

export const upsertFromStrava = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    stravaActivityId: v.string(),
    name: v.string(),
    sportType: v.string(),
    activityBucket: v.optional(v.union(v.literal('run'), v.literal('ride'), v.literal('other'))),
    startDate: v.string(),
    startDateLocal: v.optional(v.string()),
    timezone: v.optional(v.string()),
    distanceMeters: v.number(),
    movingTimeSec: v.number(),
    elapsedTimeSec: v.number(),
    totalElevationGainM: v.optional(v.number()),
    hasHeartrate: v.optional(v.boolean()),
    averageHeartrate: v.optional(v.number()),
    maxHeartrate: v.optional(v.number()),
    averageSpeed: v.optional(v.number()),
    maxSpeed: v.optional(v.number()),
    averageCadence: v.optional(v.number()),
    averageWatts: v.optional(v.number()),
    averageTempC: v.optional(v.number()),
    calories: v.optional(v.number()),
    sufferScore: v.optional(v.number()),
    trimp: v.optional(v.number()),
    processingStatus: processingStatusValidator,
    processingError: v.optional(v.string()),
    stravaGearId: v.optional(v.string()),
    splitsMetric: v.optional(v.any()),
    laps: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('activities')
      .withIndex('by_strava_activity_id', (q) => q.eq('stravaActivityId', args.stravaActivityId))
      .unique();

    const now = Date.now();

    if (existing) {
      const { stravaActivityId: _sid, athleteId: _aid, ...updates } = args;
      await ctx.db.patch(existing._id, { ...updates, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert('activities', {
      ...args,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateStatus = internalMutation({
  args: {
    activityId: v.id('activities'),
    processingStatus: processingStatusValidator,
    processingError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, {
      processingStatus: args.processingStatus,
      ...(args.processingError !== undefined ? { processingError: args.processingError } : {}),
      updatedAt: Date.now(),
    });
  },
});

export const getByStravaId = internalQuery({
  args: { stravaActivityId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activities')
      .withIndex('by_strava_activity_id', (q) => q.eq('stravaActivityId', args.stravaActivityId))
      .unique();
  },
});

export const getByDocId = internalQuery({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.activityId);
  },
});

export const listForAthlete = query({
  args: {
    athleteId: v.id('athletes'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activities')
      .withIndex('by_athlete_start', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .paginate(args.paginationOpts);
  },
});

export const listAll = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activities')
      .withIndex('by_athlete_start', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .take(500);
  },
});

export const getLatestForAthlete = query({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activities')
      .withIndex('by_athlete_start', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .first();
  },
});

export const listRecentForAthlete = query({
  args: { athleteId: v.id('athletes'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activities')
      .withIndex('by_athlete_start', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .take(args.limit ?? 200);
  },
});

export const listStravaIdsForAthlete = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const activities = await ctx.db
      .query('activities')
      .withIndex('by_athlete_start', (q) => q.eq('athleteId', args.athleteId))
      .take(2000);
    return activities.map((a) => a.stravaActivityId);
  },
});

export const listWithoutTrimp = internalQuery({
  args: { athleteId: v.id('athletes'), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const all = await ctx.db
      .query('activities')
      .withIndex('by_athlete_start', (q) => q.eq('athleteId', args.athleteId))
      .take(args.limit ?? 500);
    return all.filter((a) => a.trimp == null);
  },
});

export const patchTrimp = internalMutation({
  args: {
    activityId: v.id('activities'),
    trimp: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.activityId, {
      trimp: args.trimp,
      updatedAt: Date.now(),
    });
  },
});
