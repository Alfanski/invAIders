import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

export const getForAthlete = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stravaPollState')
      .withIndex('by_athlete', (q) => q.eq('athleteId', args.athleteId))
      .unique();
  },
});

export const update = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    lastActivityStartTime: v.number(),
    lastPollAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stravaPollState')
      .withIndex('by_athlete', (q) => q.eq('athleteId', args.athleteId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastActivityStartTime: args.lastActivityStartTime,
        lastPollAt: args.lastPollAt,
      });
      return existing._id;
    }

    return await ctx.db.insert('stravaPollState', {
      athleteId: args.athleteId,
      lastActivityStartTime: args.lastActivityStartTime,
      lastPollAt: args.lastPollAt,
    });
  },
});
