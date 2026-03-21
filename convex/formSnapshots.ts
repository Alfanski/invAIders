import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

export const upsertDay = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    date: v.string(),
    ctl: v.number(),
    atl: v.number(),
    tsb: v.number(),
    acwr: v.optional(v.number()),
    dailyTrimp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('formSnapshots')
      .withIndex('by_athlete_date', (q) => q.eq('athleteId', args.athleteId).eq('date', args.date))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ctl: args.ctl,
        atl: args.atl,
        tsb: args.tsb,
        acwr: args.acwr,
        dailyTrimp: args.dailyTrimp,
        computedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('formSnapshots', {
      athleteId: args.athleteId,
      date: args.date,
      ctl: args.ctl,
      atl: args.atl,
      tsb: args.tsb,
      ...(args.acwr != null ? { acwr: args.acwr } : {}),
      ...(args.dailyTrimp != null ? { dailyTrimp: args.dailyTrimp } : {}),
      computedAt: now,
    });
  },
});

export const listForAthlete = query({
  args: {
    athleteId: v.id('athletes'),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('formSnapshots')
      .withIndex('by_athlete_date', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .take(args.limit ?? 200);
  },
});

export const getLatestForAthlete = query({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('formSnapshots')
      .withIndex('by_athlete_date', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .first();
  },
});
