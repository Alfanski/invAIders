# IP-001g: Dashboard -- Last Week

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.5B

---

## Route: `/dashboard/week`

## Component Tree

```
WeekPage
+-- WeekHeader ("Week of Mar 15", date range)
+-- WeekSummaryBar (4 cards: activities, distance, duration, elevation)
+-- WeekComparison (6 rows: this week vs last week)
+-- ActivityList (compact cards for each activity)
+-- WeeklyCoachingReport (AI weekly analysis)
+-- WeeklyVoicePlayer
```

## WeekSummaryBar

Layout: `grid grid-cols-2 lg:grid-cols-4 gap-3`

4 cards: total activities, total distance, total duration, total elevation.
Aggregated from all activities in current week (Mon-Sun).

## WeekComparison

6 rows comparing this week vs last week:

| Metric    | Green = Improvement         |
| --------- | --------------------------- |
| Distance  | Up                          |
| Duration  | Neutral (context-dependent) |
| Avg Pace  | Faster (lower min/km)       |
| Avg HR    | Lower (at same effort)      |
| Elevation | Up                          |
| Sessions  | Up                          |

Each row shows: metric name, this week value, last week value, % change with colored arrow.

**Sentiment logic** (implement in `lib/comparison.ts`):

```ts
computeSentiment(metric: string, delta: number, sport: string): "positive" | "negative" | "neutral"
```

## ActivityList

- Compact cards for each activity in the week
- Each shows: date, name, type icon, distance, pace, avg HR, effort score
- Click navigates to `/dashboard/workout/[id]` (View A)
- Sorted by date, most recent first

## Weekly AI Analysis

**Trigger:** On-demand when user opens week tab (if no summary exists for current week, enqueue generation). Alternatively: Convex cron Sunday 23:59 athlete timezone.

**Gemini prompt:** All activities of the week aggregated + each activity's executive_summary. Separate "weekly coach" system prompt.

## Convex Queries

```ts
getActivitiesForWeek(athleteId, weekStart)   -> activity[]
getWeekComparison(athleteId, weekStart)      -> { thisWeek, lastWeek }
getWeeklyAnalysis(athleteId, weekStart)      -> weekly analysis doc or null
```

## Files to Create

| File                                              | Purpose                         |
| ------------------------------------------------- | ------------------------------- |
| `app/dashboard/week/page.tsx`                     | Week view page                  |
| `components/dashboard/week-header.tsx`            | Date range header               |
| `components/dashboard/week-summary-bar.tsx`       | 4 summary cards                 |
| `components/dashboard/week-comparison.tsx`        | This week vs last week          |
| `components/dashboard/activity-list.tsx`          | Compact activity cards          |
| `components/dashboard/activity-card.tsx`          | Single activity card            |
| `components/dashboard/weekly-coaching-report.tsx` | AI weekly summary               |
| `lib/comparison.ts`                               | `computeSentiment()` logic      |
| `lib/week-boundaries.ts`                          | `getWeekRange(date, tz)` helper |
| `convex/weekly.ts`                                | Week queries + analysis trigger |

## Implementation Sequence

1. `lib/week-boundaries.ts` (Mon-Sun range helper)
2. `getActivitiesForWeek` Convex query
3. `WeekSummaryBar` + `WeekHeader`
4. `WeekComparison` + `lib/comparison.ts`
5. `ActivityList` + `ActivityCard`
6. `getWeekComparison` Convex query
7. Weekly AI analysis trigger + `WeeklyCoachingReport`
8. `WeeklyVoicePlayer` (reuses shared `VoicePlayer`)
