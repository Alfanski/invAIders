# IP-001: CoachAgent MVP Implementation Plan

**Status:** Draft
**Phase:** 1 -- MVP
**Last updated:** 2026-03-21
**Parent:** [PRD-001-coachagent-mvp.md](PRD-001-coachagent-mvp.md)

---

## Sub-Plans

Each part of the application has its own detailed plan:

| ID | Section | Plan |
|----|---------|------|
| IP-001a | Phase 0: Scaffolding | [IP-001a-scaffolding.md](IP-001a-scaffolding.md) |
| IP-001b | Phase 1.1: Strava OAuth | [IP-001b-strava-oauth.md](IP-001b-strava-oauth.md) |
| IP-001c | Phase 1.2: Activity Trigger | [IP-001c-activity-trigger.md](IP-001c-activity-trigger.md) |
| IP-001d | Phase 1.3: Fetch Data | [IP-001d-fetch-data.md](IP-001d-fetch-data.md) |
| IP-001e | Phase 1.4: AI Analysis | [IP-001e-ai-analysis.md](IP-001e-ai-analysis.md) |
| IP-001f | Phase 1.5A: Dashboard -- Workout | [IP-001f-dashboard-workout.md](IP-001f-dashboard-workout.md) |
| IP-001g | Phase 1.5B: Dashboard -- Week | [IP-001g-dashboard-week.md](IP-001g-dashboard-week.md) |
| IP-001h | Phase 1.5C: Dashboard -- Coach Status | [IP-001h-dashboard-form.md](IP-001h-dashboard-form.md) |
| IP-001i | Phase 1.6: Voice Debrief | [IP-001i-voice-debrief.md](IP-001i-voice-debrief.md) |

---

## Shared: Convex Schema

Full schema used across all sub-plans. Single source of truth.

```ts
// convex/schema.ts
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const processingStatus = v.union(
  v.literal("received"),
  v.literal("fetching"),
  v.literal("analyzing"),
  v.literal("generating_audio"),
  v.literal("complete"),
  v.literal("error"),
);

export default defineSchema({
  athletes: defineTable({
    authSubject: v.string(),
    stravaAthleteId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    profileMediumUrl: v.optional(v.string()),
    profileUrl: v.optional(v.string()),
    measurementPreference: v.optional(
      v.union(v.literal("feet"), v.literal("meters")),
    ),
    sex: v.optional(
      v.union(v.literal("M"), v.literal("F")),
    ),
    weightKg: v.optional(v.number()),
    goalText: v.optional(v.string()),
    restingHr: v.optional(v.number()),
    maxHr: v.optional(v.number()),
    timezone: v.optional(v.string()),
    formBackfillStatus: v.optional(
      v.union(
        v.literal("idle"),
        v.literal("running"),
        v.literal("complete"),
        v.literal("error"),
      ),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_auth_subject", ["authSubject"])
    .index("by_strava_athlete_id", ["stravaAthleteId"]),

  stravaTokens: defineTable({
    athleteId: v.id("athletes"),
    accessToken: v.string(),
    refreshToken: v.string(),
    expiresAt: v.number(),
    scope: v.optional(v.string()),
    tokenVersion: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_athlete", ["athleteId"]),

  activities: defineTable({
    athleteId: v.id("athletes"),
    stravaActivityId: v.string(),
    name: v.string(),
    sportType: v.string(),
    activityBucket: v.optional(
      v.union(v.literal("run"), v.literal("ride"), v.literal("other")),
    ),
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
    .index("by_strava_activity_id", ["stravaActivityId"])
    .index("by_athlete_start", ["athleteId", "startDate"])
    .index("by_athlete_status", ["athleteId", "processingStatus"]),

  activityStreams: defineTable({
    activityId: v.id("activities"),
    kind: v.union(v.literal("downsampled"), v.literal("full")),
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
    meta: v.optional(v.object({
      windowSec: v.number(),
      pointCount: v.number(),
    })),
    updatedAt: v.number(),
  }).index("by_activity", ["activityId"]),

  analyses: defineTable({
    activityId: v.id("activities"),
    model: v.optional(v.string()),
    effortScore: v.optional(v.number()),
    executiveSummary: v.string(),
    positives: v.array(v.string()),
    improvements: v.array(v.string()),
    hrZoneAnalysis: v.optional(v.any()),
    splitAnalysis: v.optional(v.object({
      trend: v.string(),
      comment: v.string(),
    })),
    nextSession: v.optional(v.object({
      type: v.string(),
      durationMin: v.number(),
      intensity: v.string(),
      description: v.string(),
    })),
    weatherNote: v.optional(v.string()),
    voiceSummary: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_activity", ["activityId"]),

  voiceDebriefs: defineTable({
    athleteId: v.id("athletes"),
    kind: v.union(
      v.literal("activity"),
      v.literal("weekly"),
      v.literal("form"),
    ),
    activityId: v.optional(v.id("activities")),
    weeklyAnalysisId: v.optional(v.id("weeklyAnalyses")),
    formAssessmentId: v.optional(v.id("formAssessments")),
    storageId: v.optional(v.id("_storage")),
    durationSec: v.optional(v.number()),
    scriptText: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_activity", ["activityId"])
    .index("by_athlete_kind", ["athleteId", "kind", "createdAt"]),

  athleteZones: defineTable({
    athleteId: v.id("athletes"),
    heartRateZones: v.optional(v.array(v.object({
      min: v.number(),
      max: v.number(),
    }))),
    fetchedAt: v.number(),
  }).index("by_athlete", ["athleteId", "fetchedAt"]),

  gear: defineTable({
    athleteId: v.id("athletes"),
    stravaGearId: v.string(),
    name: v.string(),
    distanceMeters: v.number(),
    brandName: v.optional(v.string()),
    modelName: v.optional(v.string()),
    gearType: v.union(
      v.literal("shoe"),
      v.literal("bike"),
      v.literal("other"),
    ),
    retired: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_athlete", ["athleteId"])
    .index("by_strava_gear", ["athleteId", "stravaGearId"]),

  weeklyAnalyses: defineTable({
    athleteId: v.id("athletes"),
    weekStartLocal: v.string(),
    weekEndLocal: v.string(),
    aggregateStats: v.optional(v.object({
      activityCount: v.number(),
      distanceMeters: v.number(),
      movingTimeSec: v.number(),
      elevationGainM: v.number(),
    })),
    executiveSummary: v.optional(v.string()),
    voiceSummary: v.optional(v.string()),
    voiceStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_athlete_week", ["athleteId", "weekStartLocal"]),

  formAssessments: defineTable({
    athleteId: v.id("athletes"),
    generatedAt: v.number(),
    executiveSummary: v.string(),
    recommendations: v.array(v.string()),
    voiceSummary: v.optional(v.string()),
    voiceStorageId: v.optional(v.id("_storage")),
    createdAt: v.number(),
  }).index("by_athlete_generated", ["athleteId", "generatedAt"]),

  formSnapshots: defineTable({
    athleteId: v.id("athletes"),
    date: v.string(),
    ctl: v.number(),
    atl: v.number(),
    tsb: v.number(),
    dailyTrimp: v.optional(v.number()),
    activityIds: v.optional(v.array(v.id("activities"))),
    computedAt: v.number(),
  }).index("by_athlete_date", ["athleteId", "date"]),

  stravaPollState: defineTable({
    athleteId: v.id("athletes"),
    lastActivityStartTime: v.number(),
    lastPollAt: v.number(),
  }).index("by_athlete", ["athleteId"]),
});
```

---

## Shared: TypeScript Types

**`types/processing-status.ts`**

```ts
export type ProcessingStatus =
  | "received"
  | "fetching"
  | "analyzing"
  | "generating_audio"
  | "complete"
  | "error";
```

**`types/gemini-analysis.ts`**

```ts
export interface CoachingAnalysisV1 {
  effort_score: number;
  executive_summary: string;
  positives: string[];
  improvements: string[];
  hr_zone_analysis: Record<string, {
    pct: number;
    time_min: number;
    comment: string;
  }>;
  split_analysis: {
    trend: "negative_split" | "positive_split" | "even" | "irregular";
    fastest_split: { km: number; pace: string };
    slowest_split: { km: number; pace: string };
    comment: string;
  };
  next_session: {
    type: string;
    duration_min: number;
    intensity: string;
    description: string;
  };
  weather_note: string | null;
  voice_summary: string;
}
```

**`types/strava.ts`** -- Strava API response shapes:

- `StravaAthlete` (id, firstname, lastname, profile_medium, measurement_preference, sex, weight)
- `StravaActivitySummary` (id, name, distance, moving_time, elapsed_time, total_elevation_gain, type, start_date, start_date_local, has_heartrate, average_heartrate, max_heartrate, suffer_score, calories, average_speed, max_speed, average_cadence, average_temp, gear_id, splits_metric, laps)
- `StravaSplit` (distance, elapsed_time, elevation_difference, moving_time, split, average_speed, pace_zone)
- `StravaLap` (id, name, elapsed_time, moving_time, distance, average_heartrate, max_heartrate)
- `StravaStreamSet` (type, data, series_type, original_size, resolution)
- `StravaZonesResponse` (heart_rate.zones[])
- `StravaGear` (id, name, nickname, distance, brand_name, model_name, retired)

---

## Dependency Graph

```
Phase 0 (Scaffolding)  [IP-001a]
  |
  +-- Phase 1.1 (Strava OAuth)  [IP-001b]
  |     |
  |     +-- Phase 1.2 (Activity Trigger)  [IP-001c]
  |           |
  |           +-- Phase 1.3 (Fetch Data)  [IP-001d]
  |                 |
  |                 +-- Phase 1.4 (AI Analysis)  [IP-001e]
  |                       |
  |                       +-- Phase 1.6 (Voice Debrief)  [IP-001i]
  |
  +-- Phase 1.5A (Dashboard: Workout)  [IP-001f]  -- can start with mock data
  +-- Phase 1.5B (Dashboard: Week)  [IP-001g]  -- after 1.5A
  +-- Phase 1.5C (Dashboard: Coach Status)  [IP-001h]  -- after 1.4
```

## Recommended Build Sequence

| Step | Plan | What | Depends on |
|------|------|------|------------|
| 1 | IP-001a | Next.js + Convex + shadcn + deps | Nothing |
| 2 | IP-001a | Convex schema + types + codegen | Step 1 |
| 3 | IP-001a | Shared libs: trimp, ctl-atl-tsb, units, hr-zones | Step 2 |
| 4 | IP-001f | Dashboard shell + StatCards + SplitTable (mock data) | Step 2 |
| 5 | IP-001f | Charts: HRChart, PaceChart, ZoneDistribution | Step 3, 4 |
| 6 | IP-001f | RouteMap + ElevationProfile | Step 4 |
| 7 | IP-001b | Strava OAuth flow | Step 2 |
| 8 | IP-001c | Webhook + polling trigger | Step 7 |
| 9 | IP-001d | Fetch + downsample + store | Step 8 |
| 10 | IP-001e | Gemini analysis + TRIMP + CTL/ATL/TSB | Step 9 |
| 11 | IP-001f | Wire dashboard to real Convex data | Step 9, 10 |
| 12 | IP-001f | CoachingReport + VoicePlayer + GearCard | Step 10 |
| 13 | IP-001i | ElevenLabs pipeline in n8n | Step 10 |
| 14 | IP-001g | Week view + weekly analysis | Step 11 |
| 15 | IP-001h | Form view + backfill + gauge + charts | Step 10 |
| 16 | -- | Integration testing + polish | All |

## Parallelization

**Can run in parallel:**
- Steps 4-6 (dashboard UI with mocks) alongside Steps 7-9 (backend pipeline)
- Step 3 (pure lib functions) can be unit-tested independently
- n8n workflow design alongside frontend component work

**Must be sequential:**
- OAuth (7) before triggers (8) before fetch (9) before analysis (10)
- Schema (2) before everything else
- Real data wiring (11) only after both pipeline (10) and dashboard shell (4-6) exist

---

## Acceptance Criteria (from PRD)

- [ ] User connects Strava via OAuth
- [ ] New activity triggers automated pipeline
- [ ] AI analysis generates structured coaching feedback
- [ ] Dashboard shows last workout with charts, map, splits, AI report
- [ ] Dashboard shows last week summary with week-over-week comparison
- [ ] Dashboard shows current form (CTL/ATL/TSB gauge + chart)
- [ ] Voice debrief plays for each view
- [ ] Mobile-responsive layout
