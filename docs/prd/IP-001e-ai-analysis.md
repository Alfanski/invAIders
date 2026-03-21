# IP-001e: AI Coaching Analysis

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.4

---

## TRIMP Calculation

```ts
// lib/coaching/trimp.ts
TRIMP = duration_min * HRratio * exp(b * HRratio)

HRratio = (avgHR - restHR) / (maxHR - restHR)
b = 1.92 (male) | 1.67 (female) | 1.79 (unknown)
```

**Guards:**
- If `avgHR` is null, 0, or > 250: return null
- If `maxHR <= restHR`: return null
- Clamp `HRratio` to `[0, 1.5]` to prevent exp explosion
- Default `restHR = 60`, `maxHR = 220 - age` (or from Strava zones)

## Gemini Configuration

| Setting | Value |
|---------|-------|
| Model (per-activity) | `gemini-2.0-flash` (fast, cheap, JSON-friendly) |
| Model (weekly/form) | `gemini-2.5-pro` (better reasoning) |
| Temperature | `0.3` (reduce hallucination for metrics) |
| Response format | `application/json` (structured output) |
| Max output tokens | `2048-4096` |

## Prompt Structure

**System prompt:**

> You are an experienced endurance coach. Respond with valid JSON only
> matching the provided schema. Never invent heart rate, pace, or power
> numbers -- only use values from the user message. If data is missing,
> set fields to null and mention the gap. Use the athlete's goal to
> prioritize advice. Tone: direct, supportive, specific.

**User prompt includes:**

- Athlete profile (sex, age, rest HR, max HR, goal)
- Activity summary (type, distance, duration, avg HR, pace/speed, elevation, TRIMP)
- Splits data (pace per km, HR per split)
- Zone distribution (time in each zone, computed from streams + athlete zones)
- Stream highlights (max HR window, HR drift analysis)
- Previous comparable activity (optional, for comparison)

## Analysis JSON Schema

Key fields:

- `effort_score` (0-100)
- `executive_summary` (2-3 sentences)
- `positives[]` (2-4 items)
- `improvements[]` (2-4 items)
- `hr_zone_analysis` (Z1-Z5 with pct, time_min, comment)
- `split_analysis` (trend, fastest/slowest split, comment)
- `next_session` (type, duration, intensity, description)
- `voice_summary` (conversational text for TTS, 200-300 words max)

Full TypeScript interface in `types/gemini-analysis.ts` (see overview).

## CTL/ATL/TSB Computation

**Daily recurrence:**

```
CTL_today = CTL_yesterday * (1 - 1/42) + dailyTrimp * (1/42)
ATL_today = ATL_yesterday * (1 - 1/7)  + dailyTrimp * (1/7)
TSB_today = CTL_today - ATL_today
```

- `dailyTrimp = sum(TRIMP)` for all activities on that calendar day (athlete timezone)
- Rest days: `dailyTrimp = 0` (decay still applies)
- Initial values: `CTL_0 = 0`, `ATL_0 = 0`
- Store daily snapshots in `formSnapshots` table

**On each new activity:**

1. Compute TRIMP for the activity
2. Recompute daily series from last known snapshot forward to today
3. Upsert `formSnapshots` rows (keyed by `athleteId` + `date`)

**Backfill (first login):**

1. Fetch last 200 activities from Strava (1-2 API calls for list endpoint)
2. Extract `averageHeartrate`, `movingTime`, `startDateLocal` from each
3. Compute TRIMP per activity, aggregate by day
4. Run `projectSeries()` from day 0 through today
5. Bulk upsert to `formSnapshots`

## n8n Analysis Pipeline

| # | Node | Notes |
|---|------|-------|
| 1 | Trigger | Payload: `convexActivityId` |
| 2 | HTTP: Convex GetActivityForAnalysis | Returns downsampled streams, splits, zones |
| 3 | HTTP: Convex SetStatus | -> `analyzing` |
| 4 | Code: BuildGeminiBody | Assemble prompts + schema |
| 5 | HTTP: Gemini generateContent | JSON mode |
| 6 | Code: ParseAndValidate | Zod safeParse; on fail retry once |
| 7 | HTTP: Convex SaveAnalysis | Store analysis + TRIMP on activity |
| 8 | HTTP: Convex UpdateFitness | Recompute CTL/ATL/TSB series |
| 9 | HTTP: Convex SetStatus | -> `generating_audio` |
| 10 | On failure | -> `error` + message |

## Files to Create

| File | Purpose |
|------|---------|
| `lib/coaching/trimp.ts` | `computeTrimp()` pure function |
| `lib/coaching/ctl-atl-tsb.ts` | `ewmaStep()`, `projectSeries()` |
| `lib/coaching/zones.ts` | `bucketHrToZone()`, zone distribution computation |
| `lib/ai/prompts/activity-analysis.ts` | System + user prompt templates |
| `lib/ai/prompts/weekly-analysis.ts` | Weekly prompt template |
| `lib/ai/prompts/form-assessment.ts` | Form assessment prompt |
| `convex/analyses.ts` | Mutations: `saveAnalysis`; Queries: `getForActivity` |
| `convex/formSnapshots.ts` | `bulkUpsert`, `getSeries`, `getLatest` |
| `types/gemini-analysis.ts` | TypeScript interfaces + JSON Schema |

## Implementation Sequence

1. `lib/coaching/trimp.ts` + unit tests
2. `lib/coaching/ctl-atl-tsb.ts` + unit tests
3. `lib/coaching/zones.ts` (zone bucketing)
4. Gemini prompt templates
5. n8n analysis pipeline nodes
6. Convex `analyses` + `formSnapshots` mutations/queries
7. Backfill action for first-time users
8. Test with real activity data
