# IP-001f: Dashboard -- Last Workout

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.5A

---

## Route Structure

- `/dashboard` -- latest completed activity (default view)
- `/dashboard/workout/[activityId]` -- specific activity by ID

## Component Tree

```
WorkoutPage
+-- WorkoutHeader (name, date, type icon)
+-- StatCardGrid (3x3)
|   +-- StatCard x9 (distance, duration, pace, HR, elevation,
|                     cadence, calories, effort, temp)
+-- SplitTable (color-coded rows, trend badge)
+-- HRChart (Recharts AreaChart + zone bands + avg HR line)
+-- PaceChart (Recharts LineChart, inverted Y-axis for runs)
+-- ZoneDistribution (horizontal stacked bar)
+-- RouteMap (react-leaflet, dynamic import, no SSR)
+-- ElevationProfile (mini AreaChart below map)
+-- CoachingReport
|   +-- ExecutiveSummary (highlight box)
|   +-- PositivesList (green-accented)
|   +-- ImprovementsList (amber-accented)
|   +-- NextSessionRec (distinct card)
+-- VoicePlayer (custom audio player)
+-- GearCard (name, distance progress, replacement hint)
```

## StatCardGrid (9 Cards)

Layout: `grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4` (always 3 columns).

| Card           | Source                            | Unit conversion                    |
| -------------- | --------------------------------- | ---------------------------------- |
| Distance       | `activity.distanceMeters`         | m -> km or mi                      |
| Duration       | `activity.movingTimeSec`          | sec -> h:mm:ss                     |
| Avg Pace/Speed | `activity.averageSpeed`           | m/s -> min/km (run) or km/h (ride) |
| Avg HR         | `activity.averageHeartrate`       | bpm                                |
| Elevation      | `activity.totalElevationGainM`    | m or ft                            |
| Cadence        | `activity.averageCadence`         | spm (run) or rpm (ride)            |
| Calories       | `activity.calories`               | kcal                               |
| Effort         | `activity.trimp` or `sufferScore` | TRIMP value                        |
| Temperature    | `activity.averageTempC`           | C or F                             |

Unit system from `athlete.measurementPreference` (metric vs imperial).

## SplitTable

**Columns:** Split #, Distance, Pace, HR, Elevation +/-, Cadence, HR Zone.

**Color coding:**

- Compute min/max pace across rows
- Interpolate: fastest -> green `hsl(142 70% 36%)`, slowest -> red `hsl(0 70% 45%)`
- Apply as left border `border-l-4` on each `<tr>`

**Trend badge:** Detect negative/positive/even split from pace progression.

**Responsive:** `overflow-x-auto` on mobile; optional column hiding via `hidden sm:table-cell`.

## HRChart (Heart Rate over Time)

- Recharts `ComposedChart` with `Area` for HR data
- `ReferenceArea` for each zone (Z1-Z5) as colored background bands
- `ReferenceLine` for average HR (dashed)
- X-axis toggle: time vs distance
- ~500 data points from downsampled streams
- Zone colors match Tailwind theme tokens

## PaceChart (Pace over Time)

- Recharts `LineChart`
- **Run:** Inverted Y-axis (faster pace = higher). Transform: `displayPace = maxPace - paceMinPerKm`
- **Ride:** Normal Y-axis showing speed in km/h
- Average pace/speed as `ReferenceLine`
- X-axis: distance (km)

## ZoneDistribution

- Recharts `BarChart` with `layout="vertical"` (single horizontal stacked bar)
- Each segment = one HR zone (Z1-Z5)
- Below bar: legend showing `Z2: 45% (22:30)` for each zone
- Computed by bucketing each stream HR sample into zones using athlete zone boundaries

## RouteMap

- `react-leaflet` with OpenStreetMap tiles
- Dynamic import with `ssr: false` (Leaflet requires DOM)
- `Polyline` from `latlng` stream data (single color for MVP)
- Start marker (green) + end marker (red)
- `fitBounds()` on mount
- No GPS: placeholder card "Indoor Activity -- no GPS track"

## ElevationProfile

- Recharts `AreaChart`, X=distance, Y=altitude
- ~120px tall, minimal axes
- Positioned below the route map

## CoachingReport

- Container card with sections
- Executive summary: `rounded-lg bg-muted/60 p-3`
- Positives: green-accented list (`text-emerald-600`)
- Improvements: amber-accented list (`text-amber-700`)
- Next session: distinct `Card` with `border-primary/30 bg-primary/5`
- Loading state: skeleton matching layout

## VoicePlayer

- Custom HTML5 `<audio>` player (not browser default)
- States: loading, ready, playing, paused, error
- Controls: play/pause button, `Slider` for progress, `mm:ss / mm:ss` display
- Audio source: Convex file storage URL via `useQuery(api.files.getVoiceUrl, { storageId })`
- On URL expiry: re-query to refresh
- Keyboard: Space to play/pause
- Large touch targets on mobile (`min-h-12 min-w-12`)

## GearCard

- Shoe/bike name + cumulative distance as progress bar
- Thresholds: shoes ~600 km, bike tires ~4000 km
- Warning badge when approaching 80% of threshold

## Loading & Empty States

| State         | UI                                            |
| ------------- | --------------------------------------------- |
| Initial load  | Skeleton blocks matching each component shape |
| No activities | Illustration + CTA "Connect Strava"           |
| Processing    | `ProcessingBanner` showing pipeline stage     |
| Error         | `AlertDestructive` + retry button             |

## Convex Queries

```ts
getLatestActivity(athleteId)    -> activity + analysis + streams
getActivityById(activityId)     -> activity + analysis + streams
getAnalysisForActivity(actId)   -> analysis doc
getVoiceUrl(storageId)          -> temporary playback URL
```

## Implementation Sequence

1. Dashboard layout shell + tab bar (Workout | Week | Form)
2. `StatCard` + `StatCardGrid` with mock data + `lib/units.ts`
3. `SplitTable` from `splits_metric` + color interpolation
4. `HRChart` + zone bands (requires `lib/charts/hr-zones.ts`)
5. `PaceChart` with inverted Y-axis logic
6. `ZoneDistribution` bar
7. `RouteMap` + `ElevationProfile` (dynamic import)
8. `CoachingReport` (matches analysis JSON shape)
9. `VoicePlayer` (shared component, reused by week + form views)
10. `GearCard`
11. Loading/empty/processing states
12. Wire to real Convex queries (replace mock data)
