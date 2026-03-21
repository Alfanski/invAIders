---
name: strava-manual-sync
description: >-
  Manually sync Strava data into the Convex database. Use when the user says
  "sync strava", "pull strava data", "manual sync", "get activities from strava",
  "refresh strava data", or needs to trigger a one-time data pull from Strava
  into Convex outside the automatic cron polling.
---

# Manual Strava Sync

## When to Use

- User wants to force a Strava data sync instead of waiting for the 15-min cron
- First-time data load for a new athlete
- Backfill failed or errored and needs re-triggering
- Tokens expired and need refreshing before the cron can work

## How It Works

The script `scripts/strava-sync-to-convex.ts` bypasses the Convex CLI entirely.
It calls the **public** `api.strava.completeOAuth` action via `ConvexHttpClient`,
which:

1. Upserts the athlete profile
2. Stores fresh OAuth tokens
3. Schedules `backfillHistory` if backfill status is not `complete` or `running`
4. Backfill fetches up to 5 pages x 200 = 1000 activities (1-5 Strava API calls)
5. Computes form snapshots (CTL/ATL/TSB) after ingestion
6. Triggers AI analysis for the 5 most recent activities

## API Cost

| Step | Strava API calls |
|------|-----------------|
| OAuth token refresh | 1 (if tokens expired) |
| Athlete profile fetch | 1 (if no cached athlete info) |
| Backfill (server-side) | 1-5 (pages of 200 activities) |
| HR zones (server-side) | 1 (if not cached) |
| **Total** | **2-8 calls** |

Rate limits: 100 requests / 15 min, 1000 / day. This sync is well within limits.

## Step-by-Step

### Step 1: Run the sync script

```bash
cd /Users/cschafer002/Documents/repos/invAIders
npx tsx scripts/strava-sync-to-convex.ts
```

If no cached tokens exist (`.strava-tokens.json`), the script opens a browser for
Strava authorization. The user must approve access. Subsequent runs reuse/refresh
cached tokens automatically.

### Step 2: Verify data

After the script completes, verify activities were ingested:

```bash
npx tsx -e '
import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api.js";

async function check() {
  const convex = new ConvexHttpClient("https://fine-ibex-73.eu-west-1.convex.cloud");
  const activities = await convex.query(api.activities.listRecentForAthlete, {
    athleteId: "ATHLETE_ID_HERE" as any,
    limit: 200,
  });
  console.log("Activities in DB:", activities.length);
  for (const a of activities.slice(0, 5)) {
    console.log("  " + a.startDate.slice(0, 10) + " | " + a.sportType + " | " + a.name + " | " + a.processingStatus);
  }
}
check();
'
```

Replace `ATHLETE_ID_HERE` with the Convex athlete ID from the sync script output.

### Step 3: If backfill already complete

If the backfill status is already `complete`, calling `completeOAuth` will NOT
re-run the backfill. It will only refresh tokens. The 15-minute cron poll
(`stravaSync.pollNewActivities`) handles incremental updates automatically.

To force a full re-backfill, you would need Convex CLI access to reset the
status:

```bash
npx convex run athletes:updateBackfillStatus '{"athleteId":"<ID>","status":"idle"}'
```

Then re-run the sync script. Note: this requires `npx convex login` first.

## Key Files

| File | Purpose |
|------|---------|
| `scripts/strava-sync-to-convex.ts` | One-shot sync script (OAuth + completeOAuth) |
| `convex/strava.ts` | `completeOAuth` public action |
| `convex/stravaSync.ts` | `backfillHistory`, `pollNewActivities`, `computeFormSnapshots` |
| `convex/crons.ts` | 15-min poll schedule |
| `.strava-tokens.json` | Cached Strava OAuth tokens (gitignored) |

## Known Athlete

| Field | Value |
|-------|-------|
| Name | Lorenzo Auer |
| Strava Athlete ID | 948047812 |
| Convex Athlete ID | jn7cfd32rnq281x1xw6z08s5p583aaa2 |
| Strava Client ID | 214497 |

## Troubleshooting

**"Token refresh failed"**: The refresh token expired or was revoked. Delete
`.strava-tokens.json` and re-run the script to go through the full OAuth flow.

**"Backfill already complete"**: The backfill guard prevents re-running. If you
need a full re-sync, reset the backfill status via Convex CLI (see Step 3).

**Convex CLI "no access"**: The CLI needs `npx convex login` in an interactive
terminal. The sync script bypasses this by using `ConvexHttpClient` directly.

**Rate limited**: Wait 15 minutes and try again. The backfill uses at most 5
API calls for activity listing.
