import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

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
