import { v } from 'convex/values';

import { internalMutation, internalQuery, query } from './_generated/server';

const streamStatEntry = v.object({ min: v.number(), avg: v.number(), max: v.number() });

export const upsertForActivity = internalMutation({
  args: {
    activityId: v.id('activities'),
    kind: v.union(v.literal('downsampled'), v.literal('full')),
    timeSec: v.array(v.number()),
    distanceM: v.optional(v.array(v.number())),
    latlng: v.optional(v.array(v.array(v.number()))),
    altitudeM: v.optional(v.array(v.number())),
    heartrateBpm: v.optional(v.array(v.number())),
    cadenceRpm: v.optional(v.array(v.number())),
    watts: v.optional(v.array(v.number())),
    velocitySmooth: v.optional(v.array(v.number())),
    tempC: v.optional(v.array(v.number())),
    gradeSmooth: v.optional(v.array(v.number())),
    meta: v.optional(
      v.object({
        windowSec: v.number(),
        pointCount: v.number(),
      }),
    ),
    stats: v.optional(
      v.object({
        heartrateBpm: v.optional(streamStatEntry),
        velocitySmooth: v.optional(streamStatEntry),
        altitudeM: v.optional(streamStatEntry),
        cadenceRpm: v.optional(streamStatEntry),
        watts: v.optional(streamStatEntry),
        tempC: v.optional(streamStatEntry),
        gradeSmooth: v.optional(streamStatEntry),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('activityStreams')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .take(10);

    const match = existing.find((s) => s.kind === args.kind);
    const now = Date.now();

    if (match) {
      const { activityId: _aid, ...updates } = args;
      await ctx.db.patch(match._id, { ...updates, updatedAt: now });
      return match._id;
    }

    return await ctx.db.insert('activityStreams', {
      ...args,
      updatedAt: now,
    });
  },
});

export const getForActivity = internalQuery({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activityStreams')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .take(10);
  },
});

export const getDownsampledForActivity = query({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('activityStreams')
      .withIndex('by_activity', (q) => q.eq('activityId', args.activityId))
      .first();
  },
});
