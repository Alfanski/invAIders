import { v } from 'convex/values';

import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import { action } from './_generated/server';

export const completeOAuth = action({
  args: {
    stravaAthleteId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileMediumUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    sex: v.optional(v.union(v.literal('M'), v.literal('F'))),
    weightKg: v.optional(v.number()),
    measurementPreference: v.optional(v.union(v.literal('feet'), v.literal('meters'))),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const authSubject = `strava:${args.stravaAthleteId}`;

    const athleteId: Id<'athletes'> = await ctx.runMutation(internal.athletes.upsertFromStrava, {
      stravaAthleteId: args.stravaAthleteId,
      authSubject,
      ...(args.firstName !== undefined ? { firstName: args.firstName } : {}),
      ...(args.lastName !== undefined ? { lastName: args.lastName } : {}),
      ...(args.profileMediumUrl !== undefined ? { profileMediumUrl: args.profileMediumUrl } : {}),
      ...(args.profileUrl !== undefined ? { profileUrl: args.profileUrl } : {}),
      ...(args.sex !== undefined ? { sex: args.sex } : {}),
      ...(args.weightKg !== undefined ? { weightKg: args.weightKg } : {}),
      ...(args.measurementPreference !== undefined
        ? { measurementPreference: args.measurementPreference }
        : {}),
    });

    await ctx.runMutation(internal.stravaTokens.upsertConnection, {
      athleteId,
      accessToken: args.accessToken,
      refreshToken: args.refreshToken,
      expiresAt: args.expiresAt,
      ...(args.scope !== undefined ? { scope: args.scope } : {}),
    });

    return { athleteId: athleteId as string };
  },
});
