# IP-001h: Dashboard -- Coach Status

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.5C

---

## Route: `/dashboard/form`

## Component Tree

```
FormPage
+-- FormHeader ("Coach Status")
+-- FormBackfillBanner (if backfill running)
+-- FormGauge (SVG semicircular gauge with needle)
+-- MetricCards (3 cards: Fitness/CTL, Fatigue/ATL, Form/TSB)
+-- FitnessChart (8-week CTL/ATL/TSB lines + TSB area)
+-- WeeklyLoadChart (4-week TRIMP bar chart)
+-- RecoveryIndicator (hours since last, recovery %, readiness)
+-- ProgressionSparklines (conditional: 8+ weeks data)
+-- FormCoachingReport (AI form assessment)
+-- FormVoicePlayer
```

## FormGauge (SVG Semicircle)

- TSB range: [-40, 25] mapped to 180-degree arc
- Color zones on arc:

| Zone | TSB Range | Color | Label |
|------|-----------|-------|-------|
| Overreaching | < -30 | Red | "Overreaching -- injury risk" |
| Fatigued | -30 to -10 | Orange | "Fatigued -- absorbing load" |
| Balanced | -10 to +5 | Yellow | "Balanced -- normal training" |
| Race Ready | +5 to +15 | Green | "Race Ready -- peak form" |
| Fresh | > +15 | Blue | "Fresh -- possibly undertrained" |

- Needle: line from center to arc edge at computed angle
- Animation: CSS `transition: transform 0.8s ease-out`
- Label: "Your coach says: {zone label}"

**Angle math:**

```ts
const clamped = Math.min(25, Math.max(-40, tsb));
const t = (clamped - (-40)) / (25 - (-40));  // 0..1
const angleRad = Math.PI * (1 - t);           // pi -> 0
```

## MetricCards (CTL, ATL, TSB)

- Three cards side by side: `grid grid-cols-1 md:grid-cols-3 gap-4`
- Each shows: name, current value (1 decimal), 7-day trend arrow
- Colors: CTL = blue, ATL = red, TSB = green
- Tooltip with plain-language explanation of each metric

## FitnessChart (8 Weeks)

- Recharts `ComposedChart` (Line + Area)
- 56 data points (one per day)
- CTL: blue solid line (`#2563eb`)
- ATL: red dashed line (`#dc2626`, strokeDasharray `6 4`)
- TSB: green filled area (`rgba(34, 197, 94, 0.25)`)
- Zero reference line
- Vertical markers on activity days
- Responsive: 300px mobile, 400px desktop

## WeeklyLoadChart (4 Weeks)

- Recharts `BarChart`, 4 bars (one per week)
- Y-axis: total weekly TRIMP
- Ramp rate annotation: `ReferenceLine` at previous week * 1.1
- Warning badge if week-over-week increase > 10%

## RecoveryIndicator

**Recovery time targets by TRIMP:**

| Last Activity TRIMP | Recovery Hours |
|---------------------|----------------|
| < 50 (easy) | 12-18h |
| 50-100 (moderate) | 24-36h |
| 100-200 (hard) | 36-48h |
| > 200 (very hard) | 48-72h |

Linear interpolation within ranges.

**Display:**
- Hours since last activity
- Recovery percentage (progress bar, 0-100%)
- Readiness label: "Ready for: Easy run" / "Not ready for: Intervals"

## ProgressionSparklines (Conditional)

Only shown if 8+ weeks of data. Three mini sparkline charts (~100px tall):

1. **Avg pace trend** over time (runs only)
2. **Avg HR at similar paces** (fitness improvement proxy)
3. **Weekly volume** trend (distance or duration)

## Form AI Assessment

**Gemini prompt includes:** full CTL/ATL/TSB history (56 days), last 10 activity summaries, user goal, current training phase.

**Response:** assessment text + recommendations + `voice_summary` for TTS.

## Historical Backfill Strategy

1. On first login, fetch last 200 activities from Strava list endpoint (1-2 API calls)
2. For each: extract `averageHeartrate`, `movingTime`, `startDateLocal`
3. Compute TRIMP per activity, aggregate by calendar day
4. Run `projectSeries()` from earliest day through today
5. Bulk upsert to `formSnapshots`
6. Show "Calculating your fitness history..." loading state during backfill
7. One-time operation; gate with `athlete.formBackfillStatus`

## Files to Create

| File | Purpose |
|------|---------|
| `app/dashboard/form/page.tsx` | Coach Status page |
| `components/form/form-gauge.tsx` | SVG semicircle + needle |
| `components/form/metric-cards.tsx` | CTL / ATL / TSB cards |
| `components/form/fitness-chart.tsx` | 8-week Recharts composed chart |
| `components/form/weekly-load-chart.tsx` | 4-week TRIMP bar chart |
| `components/form/recovery-indicator.tsx` | Progress bar + readiness |
| `components/form/progression-sparklines.tsx` | 3 mini charts |
| `components/form/form-coaching-report.tsx` | AI assessment display |
| `components/form/form-backfill-banner.tsx` | Loading state |
| `lib/form/recovery.ts` | Recovery % from TRIMP + elapsed time |
| `lib/form/zones.ts` | `tsbToZone()` mapping |
| `convex/formSnapshots.ts` | `getSeries`, `getLatest`, `bulkUpsert` |
| `convex/formAssessments.ts` | `getLatestAssessment`, save assessment + voice references |

## Implementation Sequence

1. `lib/form/zones.ts` (TSB -> zone mapping) + `lib/form/recovery.ts`
2. `FormGauge` SVG component (testable standalone)
3. `MetricCards` from `formSnapshots.getLatest`
4. `FitnessChart` from `formSnapshots.getSeries` (56 days)
5. `WeeklyLoadChart` from weekly TRIMP aggregation
6. `RecoveryIndicator` from last activity TRIMP + elapsed time
7. `ProgressionSparklines` (conditional)
8. Backfill action for first-time users
9. `FormCoachingReport` + `FormVoicePlayer`
