import { v } from 'convex/values';

import { internal } from './_generated/api';
import { internalMutation, internalQuery, query } from './_generated/server';

export const upsertForWeek = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    weekStartLocal: v.string(),
    weekEndLocal: v.string(),
    aggregateStats: v.optional(
      v.object({
        activityCount: v.number(),
        distanceMeters: v.number(),
        movingTimeSec: v.number(),
        elevationGainM: v.number(),
      }),
    ),
    executiveSummary: v.optional(v.string()),
    voiceSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('weeklyAnalyses')
      .withIndex('by_athlete_week', (q) =>
        q.eq('athleteId', args.athleteId).eq('weekStartLocal', args.weekStartLocal),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      const { athleteId: _aid, weekStartLocal: _ws, ...updates } = args;
      await ctx.db.patch(existing._id, { ...updates });
      return existing._id;
    }

    return await ctx.db.insert('weeklyAnalyses', {
      ...args,
      createdAt: now,
    });
  },
});

export const getForAthleteWeek = query({
  args: {
    athleteId: v.id('athletes'),
    weekStartLocal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('weeklyAnalyses')
      .withIndex('by_athlete_week', (q) =>
        q.eq('athleteId', args.athleteId).eq('weekStartLocal', args.weekStartLocal),
      )
      .unique();
  },
});

export const getForAthleteWeekInternal = internalQuery({
  args: {
    athleteId: v.id('athletes'),
    weekStartLocal: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('weeklyAnalyses')
      .withIndex('by_athlete_week', (q) =>
        q.eq('athleteId', args.athleteId).eq('weekStartLocal', args.weekStartLocal),
      )
      .unique();
  },
});

export const scheduleRegeneration = internalMutation({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    await ctx.scheduler.runAfter(0, internal.aiAnalysis.generateWeeklySummary, {
      athleteId: args.athleteId,
    });
  },
});

export const getLatestForAthlete = query({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('weeklyAnalyses')
      .withIndex('by_athlete_week', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .first();
  },
});
