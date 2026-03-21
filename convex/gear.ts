import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';

export const upsertFromStrava = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    stravaGearId: v.string(),
    name: v.string(),
    distanceMeters: v.number(),
    brandName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    gearType: v.union(v.literal('shoe'), v.literal('bike'), v.literal('other')),
    retired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('gear')
      .withIndex('by_strava_gear', (q) =>
        q.eq('athleteId', args.athleteId).eq('stravaGearId', args.stravaGearId),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      const { athleteId: _aid, stravaGearId: _gid, ...updates } = args;
      await ctx.db.patch(existing._id, { ...updates, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert('gear', {
      ...args,
      updatedAt: now,
    });
  },
});

export const getByStravaGearId = internalQuery({
  args: {
    athleteId: v.id('athletes'),
    stravaGearId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('gear')
      .withIndex('by_strava_gear', (q) =>
        q.eq('athleteId', args.athleteId).eq('stravaGearId', args.stravaGearId),
      )
      .unique();
  },
});

export const getByStravaGearIdPublic = query({
  args: {
    athleteId: v.id('athletes'),
    stravaGearId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('gear')
      .withIndex('by_strava_gear', (q) =>
        q.eq('athleteId', args.athleteId).eq('stravaGearId', args.stravaGearId),
      )
      .unique();
  },
});
