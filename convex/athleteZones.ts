import { v } from 'convex/values';

import { internalMutation, internalQuery } from './_generated/server';

const ZONE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export const upsertForAthlete = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    heartRateZones: v.optional(
      v.array(
        v.object({
          min: v.number(),
          max: v.number(),
        }),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    const existing = await ctx.db
      .query('athleteZones')
      .withIndex('by_athlete', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .take(1);

    const latest = existing[0];

    if (latest) {
      await ctx.db.patch(latest._id, {
        ...(args.heartRateZones !== undefined ? { heartRateZones: args.heartRateZones } : {}),
        fetchedAt: now,
      });
      return latest._id;
    }

    return await ctx.db.insert('athleteZones', {
      athleteId: args.athleteId,
      ...(args.heartRateZones !== undefined ? { heartRateZones: args.heartRateZones } : {}),
      fetchedAt: now,
    });
  },
});

export const getLatest = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const results = await ctx.db
      .query('athleteZones')
      .withIndex('by_athlete', (q) => q.eq('athleteId', args.athleteId))
      .order('desc')
      .take(1);

    const latest = results[0];
    if (!latest) return null;

    const age = Date.now() - latest.fetchedAt;
    if (age > ZONE_TTL_MS) return null;

    return latest;
  },
});
