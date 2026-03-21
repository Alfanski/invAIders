# IP-001d: Fetch Full Activity Data

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.3

---

## n8n Workflow (Node by Node)

| #   | Node                       | Purpose                                                                                                                                     |
| --- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Webhook / Schedule trigger | Receive `{ activityId, athleteId }`                                                                                                         |
| 2   | HTTP: Convex SetStatus     | Set `status: "fetching"`                                                                                                                    |
| 3   | HTTP: Strava GetActivity   | `GET /activities/{id}` (summary + splits + gear)                                                                                            |
| 4   | IF: Check 404              | If deleted, mark error and stop                                                                                                             |
| 5   | HTTP: Strava GetStreams    | `GET /activities/{id}/streams?keys=time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,temp,grade_smooth&resolution=high` |
| 6   | HTTP: Strava GetLaps       | `GET /activities/{id}/laps`                                                                                                                 |
| 7   | HTTP: Convex GetZonesCache | Check if zones are cached and fresh (7-day TTL)                                                                                             |
| 8   | IF: Zones stale?           | If stale, fetch from Strava                                                                                                                 |
| 9   | HTTP: Strava GetZones      | `GET /athlete/zones` (conditional)                                                                                                          |
| 10  | HTTP: Convex UpsertZones   | Store zones if refreshed                                                                                                                    |
| 11  | IF: Has gear?              | Check `activity.gear_id`                                                                                                                    |
| 12  | HTTP: Strava GetGear       | `GET /gear/{gear_id}` (conditional, cached 24h)                                                                                             |
| 13  | Code: DownsampleStreams    | JavaScript downsampling (see below)                                                                                                         |
| 14  | HTTP: Convex SavePayload   | Store activity + streams + laps, set `status: "analyzing"`                                                                                  |

All Strava calls must run **sequentially** (not parallel) for rate limit safety.

## Stream Downsampling Algorithm

**Input:** Raw Strava streams (up to 10,000 points).

**Method:**

1. Parse streams into map by type
2. Window size: `max(30, ceil(durationSec / 500))` seconds
3. For each window:
   - Numeric streams (heartrate, velocity, altitude, cadence, watts, temp, grade): **average** of defined values
   - `latlng`: take **last** point in window (route continuity)
   - `distance`: take **last** value in window
   - `time`: window start offset from activity start

**Output:** ~500 data points max, each:

```ts
{
  (time, heartrate, velocity, altitude, cadence, watts, temp, grade, latlng, distance);
}
```

**Where it runs:** n8n Code node (avoids shipping raw 10K arrays to Convex twice).
Mirror in `lib/strava/downsample.ts` for backfill jobs.

## Activity Type Branching

| Bucket | Strava types                    | Primary speed metric     | Cadence unit | Power            |
| ------ | ------------------------------- | ------------------------ | ------------ | ---------------- |
| run    | Run, TrailRun, VirtualRun, Walk | Pace (min/km)            | spm          | no               |
| ride   | Ride, EBikeRide, VirtualRide    | Speed (km/h)             | rpm          | watts if present |
| other  | Swim, Hike, Workout, ...        | Duration + distance only | optional     | optional         |

Derive `activityBucket` when saving to Convex. Affects dashboard display and AI prompt.

## Error Handling

| Case               | Strategy                                                                     |
| ------------------ | ---------------------------------------------------------------------------- |
| 404                | `status: "error"`, `error_message: "strava_404_deleted"`, stop               |
| 429                | Read `Retry-After`, wait, retry up to 5x with exponential backoff (base 30s) |
| Partial streams    | Proceed with nulls; prompt notes "HR missing" / "no GPS"                     |
| No GPS (treadmill) | `latlng` null; map hidden; route analysis omitted                            |
| Network timeout    | Retry 3x with backoff, then `error_message: "strava_timeout"`                |

## Implementation Sequence

1. n8n workflow skeleton with webhook trigger
2. Strava fetch nodes (sequential) with token from Convex
3. Downsampling Code node (JavaScript)
4. Convex save mutations + status transitions
5. Test with a real Strava activity
