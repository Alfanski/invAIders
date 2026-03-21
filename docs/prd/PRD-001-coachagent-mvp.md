# PRD-001: CoachAgent MVP

**Status:** Draft
**Phase:** 1 -- MVP
**Last updated:** 2026-03-21

## Problem

Athletes finish workouts and get raw numbers from Strava. Interpreting those numbers, understanding trends, and knowing what to do next requires coaching knowledge most people don't have.

## Solution

You finish a workout, and by the time you check your phone, an AI coach has already analyzed your performance, generated a visual dashboard, and recorded a voice debrief you can listen to while stretching.

## Stack

Next.js (Vercel) + Convex + n8n + Gemini + ElevenLabs + Strava API

---

## 1.1 Strava OAuth Login (2h)

- "Connect with Strava" button, OAuth 2.0 redirect flow
- Store `access_token`, `refresh_token`, `expires_at`, `athlete_id` in Convex (restricted table, not client-readable)
- Auto-refresh token logic
- Also store athlete profile (name, pic, measurement preference) on first auth
- Be aware: **100 req/15min, 1000 req/day** rate limits

## 1.2 Activity Trigger (1.5h)

- **Primary:** Strava webhook via Vercel API route (GET for challenge, POST forwards to n8n)
- **Fallback:** n8n polls `GET /athlete/activities?after={last_check}` every 60s
- Recommendation: start with polling Saturday morning, switch to webhook if time permits
- Webhook needs publicly routable URL (ngrok/Cloudflare Tunnel for local dev)
- Filter webhook events: only process `create`, ignore title/gear edits

## 1.3 Fetch Full Activity Data (1h)

- n8n receives `object_id`, fetches:
  - `GET /activities/{id}` -- summary (distance, time, HR, elevation, splits_metric, laps, gear, suffer_score)
  - `GET /activities/{id}/streams?keys=time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,temp,grade_smooth` -- second-by-second streams
  - `GET /activities/{id}/laps` -- structured lap data (essential for intervals)
  - `GET /athlete/zones` -- user's HR zone boundaries (once, cache it)
- **Downsample streams** before AI analysis: rolling 30s averages, ~500 points max
- Store raw data in Convex with processing `status` field: `received > fetching > analyzing > generating_audio > complete > error`
- Handle activity types: at minimum differentiate Run vs Ride vs other

## 1.4 AI Coaching Analysis (2h)

- n8n sends activity JSON to Gemini with structured prompt
- Prompt includes: downsampled activity data, splits, zones, user goal (text field on profile, hardcoded for MVP)
- Gemini returns structured JSON:

```json
{
  "effort_score": 78,
  "executive_summary": "...",
  "positives": ["..."],
  "improvements": ["..."],
  "hr_zone_analysis": { "Z1": { "pct": 12, "comment": "..." } },
  "split_analysis": { "trend": "negative_split", "comment": "..." },
  "next_session": {
    "type": "Easy Run",
    "duration_min": 45,
    "intensity": "Z1-Z2",
    "description": "..."
  },
  "weather_note": "..."
}
```

- Compute TRIMP per activity: `duration_min x HRratio x e^(b x HRratio)` where `HRratio = (avgHR - restHR) / (maxHR - restHR)`, `b = 1.92 (m) / 1.67 (f)`
- Store analysis + TRIMP in Convex linked to activity

## 1.5 Dashboard (5-6h)

Three views. Mobile-first. Use shadcn/ui for all components. Recharts for charts.

### View A: Last Workout

| Section                                                                                                                                     | Data Source                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| **9 stat cards:** distance, duration, avg pace, avg HR, elevation, cadence, calories, effort (TRIMP or suffer_score), temp                  | `activity.*`, convert `average_speed` m/s to min/km                                     |
| **Split table:** km, pace, HR, elevation, cadence, zone per split. Color-coded rows (green=fast, red=slow). Detect negative/positive split. | `activity.splits_metric[]`                                                              |
| **HR over time chart:** area chart with Z1-Z5 background bands, avg HR overlay line                                                         | `streams.heartrate` + `streams.time`, downsampled to ~500pts                            |
| **Pace over time chart:** line chart, inverted Y-axis (faster=higher), avg pace overlay                                                     | `streams.velocity_smooth` + `streams.distance`                                          |
| **Zone distribution:** horizontal stacked bar, Z1-Z5 with percentages and time                                                              | `streams.heartrate` bucketed by `athlete.zones` boundaries                              |
| **GPS route map:** Leaflet + OSM, single-color polyline (color-coded = Phase 2). Start/end markers. Elevation profile mini-chart below.     | `streams.latlng` + `streams.altitude`                                                   |
| **AI coaching report:** summary, positives, improvements, next session rec                                                                  | Gemini analysis JSON                                                                    |
| **Voice debrief player:** inline audio, duration shown                                                                                      | ElevenLabs audio URL (download + store in Convex file storage, don't rely on temp URLs) |
| **Gear card:** shoe/bike name, cumulative km, progress bar, replacement hint                                                                | `activity.gear` + `GET /gear/{id}`                                                      |

### View B: Last Week

| Section                                                                                                                                                    | Data Source                                                  |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| **Week summary bar:** total activities, distance, duration, elevation                                                                                      | `GET /athlete/activities?after={7d_ago}`, aggregate          |
| **Week-over-week comparison:** distance, duration, avg pace, avg HR, elevation, sessions -- this week vs last week, with % change arrows (green=improving) | Two weeks of activities, compare aggregates                  |
| **Activity list:** compact cards -- date, name, type, distance, pace, HR, effort, link to full view                                                        | Activity summaries                                           |
| **AI weekly summary + voice debrief**                                                                                                                      | All week's data sent to Gemini with "weekly analysis" prompt |

### View C: Current Form ("Coach Status")

Requires historical data: on first login, fetch last ~200 activities from Strava.

**The math (Fitness-Fatigue / Banister model):**

```
Per activity: TRIMP = duration_min x HRratio x e^(b x HRratio)

Daily rolling metrics:
  CTL (Fitness) = 42-day exp. weighted avg of daily TRIMP   (decay = 0.02353)
  ATL (Fatigue) = 7-day exp. weighted avg of daily TRIMP    (decay = 0.13353)
  TSB (Form)    = CTL - ATL

TSB interpretation:
  > +15     Fresh / possibly undertrained
  +5 to +15 Race-ready, peak form
  -10 to +5 Balanced, normal training
  -30 to -10 Fatigued, absorbing load
  < -30     Overreaching, injury risk
```

| Section                                                                                                                                               | Data Source                                                                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Form gauge:** semicircular gauge, needle at current TSB, color zones. Label: "Your coach says: Race Ready"                                          | Computed TSB                                                                                                                   |
| **3 metric cards:** Fitness (CTL), Fatigue (ATL), Form (TSB) -- each with value + 7-day trend arrow                                                   | Computed daily                                                                                                                 |
| **Fitness/Fatigue/Form chart (8 weeks):** 3 overlaid lines. CTL=blue solid, ATL=red dashed, TSB=green filled area. Vertical markers on activity days. | Computed time series                                                                                                           |
| **Weekly load trend (4 weeks):** bar chart of total weekly TRIMP. Flag if >10% sustained ramp rate.                                                   | Sum TRIMP per week                                                                                                             |
| **Recovery indicator:** hours since last activity, estimated recovery %, bar. "Ready for: Easy run" / "Not ready for: Intervals"                      | Last activity TRIMP + elapsed time. Easy<50 = 12-18h, Moderate 50-100 = 24-36h, Hard 100-200 = 36-48h, Very hard >200 = 48-72h |
| **Long-term progression (if 8+ weeks):** sparklines for avg pace trend, avg HR at same pace, weekly volume                                            | Historical activity comparison                                                                                                 |
| **AI form assessment + voice briefing**                                                                                                               | Full history + CTL/ATL/TSB fed to Gemini                                                                                       |

## 1.6 Voice Debrief (1.5h)

- n8n sends coaching text to ElevenLabs, receives audio
- **Download the audio and store in Convex file storage** (ElevenLabs temp URLs expire)
- Keep voice text concise: spoken summary, not the full written analysis (~1-2 min)
- Dashboard audio player with play/pause and duration
- Three debriefs: per-activity, weekly, form assessment

---

## Time Estimate: ~14-16h

| Task                    | Hours |
| ----------------------- | ----- |
| Strava OAuth            | 2     |
| Activity trigger        | 1.5   |
| Fetch + store data      | 1     |
| AI analysis + TRIMP     | 2     |
| Dashboard (3 views)     | 5-6   |
| Voice debrief           | 1.5   |
| Integration + debugging | 1-2   |

---

## Phase 2: Nice-to-Have (Sunday, pick in order)

| #    | Feature                                                                                              | Time | Why                                   |
| ---- | ---------------------------------------------------------------------------------------------------- | ---- | ------------------------------------- |
| 2.1  | **Notifications** -- Slack/Discord/email after analysis with stats + link                            | 1h   | Lowest effort, highest wow            |
| 2.2  | **Race Prediction** -- Gemini estimates 5K/10K/HM/M times from training history                      | 1h   | Single card, huge demo moment         |
| 2.3  | **Coach Personality** -- prompt engineering for tone/style/memory                                    | 0.5h | Zero code, just a better prompt       |
| 2.4  | **Weather Context** -- OpenWeatherMap historical data injected into AI prompt                        | 1h   | Makes AI feel genuinely smart         |
| 2.5  | **Training Plan + Calendar Push** -- Gemini generates 7-day plan, n8n pushes to Google Calendar      | 2h   | "The AI scheduled my next 3 workouts" |
| 2.6  | **Gear Tracking + Alerts** -- cumulative km per shoe/bike, replacement warnings                      | 1h   | Easy API call, nice detail            |
| 2.7  | **Color-coded GPS map** -- pace or HR mapped to polyline segment colors                              | 1.5h | Visually impressive upgrade           |
| 2.8  | **Historical Trends** -- fetch 60+ activities, multi-week pace/HR/volume charts, AI trend commentary | 2h   | Most valuable long-term               |
| 2.9  | **Comparative Analysis** -- "vs your last similar run: 8s/km faster at 3bpm lower HR"                | 1h   | Low-effort, high-impact               |
| 2.10 | **Shareable Report Card** -- OG image of workout summary for social sharing                          | 1.5h | Athletes love sharing                 |

---

## Strava API Quick Reference

| Endpoint                                                          | Returns                                                                     | Rate Cost |
| ----------------------------------------------------------------- | --------------------------------------------------------------------------- | --------- |
| `GET /athlete`                                                    | Profile, measurement pref                                                   | 1         |
| `GET /athlete/zones`                                              | HR + power zone boundaries                                                  | 1         |
| `GET /athletes/{id}/stats`                                        | Recent/YTD/all-time totals (run/ride/swim)                                  | 1         |
| `GET /athlete/activities?per_page=200&after=`                     | Activity list (paginated)                                                   | 1         |
| `GET /activities/{id}`                                            | Full activity detail + splits + laps + segments + gear                      | 1         |
| `GET /activities/{id}/streams?keys=...`                           | Second-by-second data (time, HR, pace, GPS, altitude, cadence, watts, temp) | 1         |
| `GET /activities/{id}/zones`                                      | Time-in-zone per activity (premium only)                                    | 1         |
| `GET /activities/{id}/laps`                                       | Structured lap data                                                         | 1         |
| `GET /gear/{id}`                                                  | Gear name + cumulative distance                                             | 1         |
| **Limits:** 100 req/15min, 1000 req/day                           |                                                                             |           |
| **Streams resolution:** low=100pts, medium=1000pts, high=10000pts |                                                                             |           |

---

## Architecture Notes

- **Convex reactive subscriptions** = dashboard updates live when analysis completes. No polling, no refresh.
- **n8n as orchestration** = pragmatic for hackathon. Long-term, Convex actions could replace it.
- **Processing pipeline has 8+ hops** (Strava > Vercel > n8n > Strava > n8n > Gemini > n8n > ElevenLabs > Convex). Use the `status` field on each activity record to track where things stall.
- **Don't call it "Body Battery"** (Garmin trademark). Use "Coach Status" or "Form Score" or "Readiness".

## Acceptance Criteria

- [ ] User connects Strava via OAuth
- [ ] New activity triggers automated pipeline
- [ ] AI analysis generates structured coaching feedback
- [ ] Dashboard shows last workout with charts, map, splits, AI report
- [ ] Dashboard shows last week summary with week-over-week comparison
- [ ] Dashboard shows current form (CTL/ATL/TSB gauge + chart)
- [ ] Voice debrief plays for each view
- [ ] Mobile-responsive layout
