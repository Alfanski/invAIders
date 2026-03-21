import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

export const upsertForActivity = internalMutation({
  args: {
    activityId: v.id('activities'),
    model: v.optional(v.string()),
    effortScore: v.optional(v.number()),
    executiveSummary: v.string(),
    positives: v.array(v.string()),
    improvements: v.array(v.string()),
    hrZoneAnalysis: v.optional(v.any()),
    splitAnalysis: v.optional(
      v.object({
        trend: v.string(),
        comment: v.string(),
      }),
    ),
    nextSession: v.optional(
      v.object({
        type: v.string(),
        durationMin: v.number(),
        intensity: v.string(),
        description: v.string(),
      }),
    ),
    weatherNote: v.optional(v.string()),
    voiceSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('analyses')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .unique();

    const now = Date.now();

    if (existing) {
      const { activityId: _aid, ...updates } = args;
      await ctx.db.patch(existing._id, { ...updates });
      return existing._id;
    }

    return await ctx.db.insert('analyses', {
      ...args,
      createdAt: now,
    });
  },
});

export const getForActivity = query({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('analyses')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .unique();
  },
});
