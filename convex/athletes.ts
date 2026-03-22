import { v } from 'convex/values';

import { internalMutation, internalQuery, mutation, query } from './_generated/server';

export const upsertFromStrava = internalMutation({
  args: {
    stravaAthleteId: v.string(),
    authSubject: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileMediumUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    sex: v.optional(v.union(v.literal('M'), v.literal('F'))),
    weightKg: v.optional(v.number()),
    measurementPreference: v.optional(v.union(v.literal('feet'), v.literal('meters'))),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('athletes')
      .withIndex('by_strava_athlete_id', (q) => q.eq('stravaAthleteId', args.stravaAthleteId))
      .unique();

    const now = Date.now();

    const profile = {
      ...(args.firstName !== undefined ? { firstName: args.firstName } : {}),
      ...(args.lastName !== undefined ? { lastName: args.lastName } : {}),
      ...(args.profileMediumUrl !== undefined ? { profileMediumUrl: args.profileMediumUrl } : {}),
      ...(args.profileUrl !== undefined ? { profileUrl: args.profileUrl } : {}),
      ...(args.sex !== undefined ? { sex: args.sex } : {}),
      ...(args.weightKg !== undefined ? { weightKg: args.weightKg } : {}),
      ...(args.measurementPreference !== undefined
        ? { measurementPreference: args.measurementPreference }
        : {}),
    };

    if (existing) {
      await ctx.db.patch(existing._id, { ...profile, updatedAt: now });
      return existing._id;
    }

    return await ctx.db.insert('athletes', {
      stravaAthleteId: args.stravaAthleteId,
      authSubject: args.authSubject,
      ...profile,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const getProfile = query({
  args: { stravaAthleteId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('athletes')
      .withIndex('by_strava_athlete_id', (q) => q.eq('stravaAthleteId', args.stravaAthleteId))
      .unique();
  },
});

export const getById = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.athleteId);
  },
});

export const getByStravaAthleteId = internalQuery({
  args: { stravaAthleteId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('athletes')
      .withIndex('by_strava_athlete_id', (q) => q.eq('stravaAthleteId', args.stravaAthleteId))
      .unique();
  },
});

export const listAllInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query('athletes').take(100);
  },
});

export const getBackfillStatus = internalQuery({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const athlete = await ctx.db.get(args.athleteId);
    return athlete?.formBackfillStatus ?? null;
  },
});

export const updateBackfillStatus = internalMutation({
  args: {
    athleteId: v.id('athletes'),
    status: v.union(
      v.literal('idle'),
      v.literal('running'),
      v.literal('complete'),
      v.literal('error'),
    ),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.athleteId, {
      formBackfillStatus: args.status,
      updatedAt: Date.now(),
    });
  },
});

export const getProfileForAnalysis = query({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const athlete = await ctx.db.get(args.athleteId);
    if (!athlete) return null;

    return {
      _id: athlete._id,
      firstName: athlete.firstName ?? null,
      lastName: athlete.lastName ?? null,
      sex: athlete.sex ?? null,
      weightKg: athlete.weightKg ?? null,
      restingHr: athlete.restingHr ?? null,
      maxHr: athlete.maxHr ?? null,
      goalText: athlete.goalText ?? null,
      coachPersonality: athlete.coachPersonality ?? null,
      measurementPreference: athlete.measurementPreference ?? null,
    };
  },
});

export const getFullProfile = query({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const athlete = await ctx.db.get(args.athleteId);
    if (!athlete) return null;

    return {
      _id: athlete._id,
      firstName: athlete.firstName ?? null,
      lastName: athlete.lastName ?? null,
      profileMediumUrl: athlete.profileMediumUrl ?? null,
      sex: athlete.sex ?? null,
      weightKg: athlete.weightKg ?? null,
      heightCm: athlete.heightCm ?? null,
      restingHr: athlete.restingHr ?? null,
      maxHr: athlete.maxHr ?? null,
      goalText: athlete.goalText ?? null,
      coachPersonality: athlete.coachPersonality ?? null,
      measurementPreference: athlete.measurementPreference ?? null,
      timezone: athlete.timezone ?? null,
    };
  },
});

export const updateProfile = mutation({
  args: {
    athleteId: v.id('athletes'),
    goalText: v.optional(v.string()),
    weightKg: v.optional(v.number()),
    heightCm: v.optional(v.number()),
    restingHr: v.optional(v.number()),
    maxHr: v.optional(v.number()),
    coachPersonality: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { athleteId, ...fields } = args;
    const athlete = await ctx.db.get(athleteId);
    if (!athlete) throw new Error(`Athlete ${athleteId} not found`);

    await ctx.db.patch(athleteId, { ...fields, updatedAt: Date.now() });
  },
});

export const getStravaLinkStatus = query({
  args: { stravaAthleteId: v.string() },
  handler: async (ctx, args) => {
    const athlete = await ctx.db
      .query('athletes')
      .withIndex('by_strava_athlete_id', (q) => q.eq('stravaAthleteId', args.stravaAthleteId))
      .unique();

    if (!athlete) {
      return { linked: false as const };
    }

    return {
      linked: true as const,
      athleteName: [athlete.firstName, athlete.lastName].filter(Boolean).join(' ') || null,
      profileImage: athlete.profileMediumUrl ?? null,
      measurementPreference: athlete.measurementPreference ?? null,
    };
  },
});
