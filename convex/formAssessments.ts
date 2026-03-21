import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

export const upsertForDate = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    generatedAt: v.string(),
    executiveSummary: v.string(),
    recommendations: v.array(v.string()),
    voiceSummary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const generatedAtMs = new Date(args.generatedAt).getTime();

    const existing = await ctx.db
      .query('formAssessments')
      .withIndex('by_athlete_generated', (q) =>
        q.eq('athleteId', args.athleteId).eq('generatedAt', generatedAtMs),
      )
      .unique();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        executiveSummary: args.executiveSummary,
        recommendations: args.recommendations,
        voiceSummary: args.voiceSummary,
      });
      return existing._id;
    }

    return await ctx.db.insert('formAssessments', {
      athleteId: args.athleteId,
      generatedAt: generatedAtMs,
      executiveSummary: args.executiveSummary,
      recommendations: args.recommendations,
      ...(args.voiceSummary != null ? { voiceSummary: args.voiceSummary } : {}),
      createdAt: now,
    });
  },
});

export const getLatestForAthlete = query({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('formAssessments')
      .withIndex('by_athlete_generated', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .first();
  },
});
