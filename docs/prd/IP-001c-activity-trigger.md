# IP-001c: Activity Trigger

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.2

---

## Polling (Start Here)

**n8n Workflow:**

1. **Schedule Trigger** -- every 3-5 minutes (not 60s; rate limit math: 1/min = 1440/day, exceeds Strava's 1000/day cap)
2. **HTTP Request** -- POST to Convex HTTP endpoint `/poll/strava` with `Authorization: Bearer {N8N_INTERNAL_SECRET}`
3. **Convex HTTP Action** -- for each athlete:
   - Refresh token if needed
   - `GET /athlete/activities?after={lastActivityStartTime}&per_page=30`
   - For each new activity, upsert with `status: "received"`
   - Update `stravaPollState.lastActivityStartTime` to max `start_date` seen

**Cursor tracking:** Store max `start_date` (not wall clock) -- catches old activities uploaded retroactively.

**Deduplication:** Unique index on `stravaActivityId`; upsert is no-op if exists.

## Webhook (Upgrade Path)

**Subscription creation** (one-time):

```
POST https://www.strava.com/api/v3/push_subscriptions
  client_id, client_secret, callback_url, verify_token
```

**`GET /api/webhooks/strava`** -- Verification:

- Echo `hub.challenge` if `hub.verify_token` matches env

**`POST /api/webhooks/strava`** -- Event handling:

- Filter: only `object_type === "activity"` and `aspect_type === "create"`
- Forward `{ stravaActivityId, ownerId }` to n8n webhook URL
- Return 200 immediately (heavy work is async)

**Local dev:** ngrok or Cloudflare Tunnel for public HTTPS URL

## Edge Cases

| Case | Handling |
|------|----------|
| Bulk sync (many activities at once) | Per-activity idempotency + throttled concurrency (max 3 parallel Strava fetches) |
| Manual activity (no GPS/streams) | Pipeline proceeds without streams; skip downsampling, analyze summary only |
| Activity deleted after webhook | `GET /activities/{id}` returns 404 -> mark `status: "error"`, stop |
| Rate limit (429) | Read `Retry-After`, pause, shift `nextPollAt` |
| Duplicate webhook events | Unique index + idempotent handler returns 200 |

## Files to Create

| File | Purpose |
|------|---------|
| `app/api/webhooks/strava/route.ts` | GET (challenge) + POST (event filter + forward) |
| `convex/http.ts` | Secured endpoints for n8n calls |
| `convex/stravaPollState.ts` | Cursor tracking mutations/queries |

## Implementation Sequence

1. Convex `activities` table + unique `stravaActivityId` index + minimal ingest mutation
2. Convex poll HTTP endpoint + `stravaPollState` cursor
3. n8n scheduled workflow hitting poll endpoint (3-5 min)
4. Vercel Strava webhook GET/POST routes
5. Test: verify deduplication and idempotency
