import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

export const upsertConnection = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('stravaTokens')
      .withIndex('by_athlete', (q) => q.eq('athleteId', args.athleteId))
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        accessToken: args.accessToken,
        refreshToken: args.refreshToken,
        expiresAt: args.expiresAt,
        ...(args.scope !== undefined ? { scope: args.scope } : {}),
        tokenVersion: (existing.tokenVersion ?? 0) + 1,
        updatedAt: now,
      });
      return existing._id;
    }

    return await ctx.db.insert('stravaTokens', {
      athleteId: args.athleteId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      ...(args.scope !== undefined ? { scope: args.scope } : {}),
      tokenVersion: 1,
      updatedAt: now,
    });
  },
});

export const listAll = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('stravaTokens').take(100);
  },
});

export const getForAthlete = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('stravaTokens')
      .withIndex('by_athlete', (q) => q.eq('athleteId', args.athleteId))
      .unique();
  },
});
