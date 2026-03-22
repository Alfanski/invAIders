import { v } from 'convex/values';

import { internalMutation, query } from './_generated/server';

export const saveDebrief = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    kind: v.union(v.literal('activity'), v.literal('weekly'), v.literal('form')),
    activityId: v.optional(v.id('activities')),
    weeklyAnalysisId: v.optional(v.id('weeklyAnalyses')),
    formAssessmentId: v.optional(v.id('formAssessments')),
    storageId: v.optional(v.id('_storage')),
    durationSec: v.optional(v.number()),
    scriptText: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    if (args.kind === 'activity' && args.activityId) {
      const existing = await ctx.db
        .query('voiceDebriefs')
        .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
        .unique();

      if (existing) {
        const { kind: _k, ...updates } = args;
        await ctx.db.patch(existing._id, updates);
        return existing._id;
      }
    }

    return await ctx.db.insert('voiceDebriefs', {
      ...args,
      createdAt: now,
    });
  },
});

export const getForActivity = query({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    const debrief = await ctx.db
      .query('voiceDebriefs')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .unique();

    if (!debrief) return null;

    const audioUrl = debrief.storageId ? await ctx.storage.getUrl(debrief.storageId) : null;

    return {
      _id: debrief._id,
      audioUrl,
      scriptText: debrief.scriptText ?? null,
      durationSec: debrief.durationSec ?? null,
      createdAt: debrief.createdAt,
    };
  },
});
