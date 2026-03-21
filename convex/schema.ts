import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const processingStatus = v.union(
  v.literal('received'),
  v.literal('fetching'),
  v.literal('analyzing'),
  v.literal('generating_audio'),
  v.literal('complete'),
  v.literal('error'),
);

export default defineSchema({
  athletes: defineTable({
    authSubject: v.string(),
    stravaAthleteId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileMediumUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    measurementPreference: v.optional(v.union(v.literal('feet'), v.literal('meters'))),
    sex: v.optional(v.union(v.literal('M'), v.literal('F'))),
    weightKg: v.optional(v.number()),
    goalText: v.optional(v.string()),
    restingHr: v.optional(v.number()),
    maxHr: v.optional(v.number()),
    timezone: v.optional(v.string()),
    formBackfillStatus: v.optional(
      v.union(v.literal('idle'), v.literal('running'), v.literal('complete'), v.literal('error')),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_auth_subject', ['authSubject'])
    .index('by_strava_athlete_id', ['stravaAthleteId']),

  stravaTokens: defineTable({
    athleteId: v.id('athletes'),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenVersion: v.optional(v.number()),
    updatedAt: v.number(),
  }).index('by_athlete', ['athleteId']),

  activities: defineTable({
    athleteId: v.id('athletes'),
    stravaActivityId: v.string(),
    name: v.string(),
    sportType: v.string(),
    activityBucket: v.optional(v.union(v.literal('run'), v.literal('ride'), v.literal('other'))),
    startDate: v.string(),
    startDateLocal: v.optional(v.string()),
    timezone: v.optional(v.string()),
    distanceMeters: v.number(),
    movingTimeSec: v.number(),
    elapsedTimeSec: v.number(),
    totalElevationGainM: v.optional(v.number()),
    hasHeartrate: v.optional(v.boolean()),
    averageHeartrate: v.optional(v.number()),
    maxHeartrate: v.optional(v.number()),
    averageSpeed: v.optional(v.number()),
    maxSpeed: v.optional(v.number()),
    averageCadence: v.optional(v.number()),
    averageWatts: v.optional(v.number()),
    averageTempC: v.optional(v.number()),
    calories: v.optional(v.number()),
    sufferScore: v.optional(v.number()),
    trimp: v.optional(v.number()),
    processingStatus: processingStatus,
    processingError: v.optional(v.string()),
    stravaGearId: v.optional(v.string()),
    splitsMetric: v.optional(v.any()),
    laps: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index('by_strava_activity_id', ['stravaActivityId'])
    .index('by_athlete_start', ['athleteId', 'startDate'])
    .index('by_athlete_status', ['athleteId', 'processingStatus']),

  activityStreams: defineTable({
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
        heartrateBpm: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
        velocitySmooth: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
        altitudeM: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
        cadenceRpm: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
        watts: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
        tempC: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
        gradeSmooth: v.optional(v.object({ min: v.number(), avg: v.number(), max: v.number() })),
      }),
    ),
    updatedAt: v.number(),
  }).index('by_activity', ['activityId']),

  analyses: defineTable({
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
    createdAt: v.number(),
  }).index('by_activity', ['activityId']),

  voiceDebriefs: defineTable({
    athleteId: v.id('athletes'),
    kind: v.union(v.literal('activity'), v.literal('weekly'), v.literal('form')),
    activityId: v.optional(v.id('activities')),
    weeklyAnalysisId: v.optional(v.id('weeklyAnalyses')),
    formAssessmentId: v.optional(v.id('formAssessments')),
    storageId: v.optional(v.id('_storage')),
    durationSec: v.optional(v.number()),
    scriptText: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index('by_activity', ['activityId'])
    .index('by_athlete_kind', ['athleteId', 'kind', 'createdAt']),

  athleteZones: defineTable({
    athleteId: v.id('athletes'),
    heartRateZones: v.optional(
      v.array(
        v.object({
          min: v.number(),
          max: v.number(),
        }),
      ),
    ),
    fetchedAt: v.number(),
  }).index('by_athlete', ['athleteId', 'fetchedAt']),

  gear: defineTable({
    athleteId: v.id('athletes'),
    stravaGearId: v.string(),
    name: v.string(),
    distanceMeters: v.number(),
    brandName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    gearType: v.union(v.literal('shoe'), v.literal('bike'), v.literal('other')),
    retired: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index('by_athlete', ['athleteId'])
    .index('by_strava_gear', ['athleteId', 'stravaGearId']),

  weeklyAnalyses: defineTable({
    athleteId: v.id('athletes'),
    weekStartLocal: v.string(),
    weekEndLocal: v.string(),
    aggregateStats: v.optional(
      v.object({
        activityCount: v.number(),
        distanceMeters: v.number(),
        movingTimeSec: v.number(),
        elevationGainM: v.number(),
      }),
    ),
    executiveSummary: v.optional(v.string()),
    voiceSummary: v.optional(v.string()),
    voiceStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
  }).index('by_athlete_week', ['athleteId', 'weekStartLocal']),

  formAssessments: defineTable({
    athleteId: v.id('athletes'),
    generatedAt: v.number(),
    executiveSummary: v.string(),
    recommendations: v.array(v.string()),
    voiceSummary: v.optional(v.string()),
    voiceStorageId: v.optional(v.id('_storage')),
    createdAt: v.number(),
  }).index('by_athlete_generated', ['athleteId', 'generatedAt']),

  formSnapshots: defineTable({
    athleteId: v.id('athletes'),
    date: v.string(),
    ctl: v.number(),
    atl: v.number(),
    tsb: v.number(),
    acwr: v.optional(v.number()),
    dailyTrimp: v.optional(v.number()),
    activityIds: v.optional(v.array(v.id('activities'))),
    computedAt: v.number(),
  }).index('by_athlete_date', ['athleteId', 'date']),

  stravaPollState: defineTable({
    athleteId: v.id('athletes'),
    lastActivityStartTime: v.number(),
    lastPollAt: v.number(),
  }).index('by_athlete', ['athleteId']),
});
