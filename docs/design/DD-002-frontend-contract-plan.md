# DD-002: Frontend contract plan (Workout + Week + Coach Status)

**Status:** Draft (planning only, no implementation)  
**Last updated:** 2026-03-21  
**Related:** [DD-001](DD-001-application-architecture-plan.md), [IP-001f](../prd/IP-001f-dashboard-workout.md), [IP-001g](../prd/IP-001g-dashboard-week.md), [IP-001h](../prd/IP-001h-dashboard-form.md)

---

## Purpose

Combine the three dashboard planning reviews into one frontend contract document so implementation can start with low churn.

This document defines:

- What is frozen now for frontend work
- What is still open and must be decided before real data wiring
- A staged plan to move from mocks to Convex-backed screens

---

## Scope

In scope:

- View A: Last Workout (`/dashboard`, `/dashboard/workout/[activityId]`)
- View B: Last Week (`/dashboard/week`)
- View C: Coach Status (`/dashboard/form`)
- Shared concerns: IDs, auth/session behavior, units/time conventions, status handling, voice optionality

Out of scope:

- Backend implementation details for n8n workflows
- Full security review of server-to-server endpoints
- Production observability and analytics tooling

---

## Frontend contract snapshot

## 1) Frozen now (safe to build against)

1. **UI composition and route structure**
   - Keep the component trees from `IP-001f`, `IP-001g`, `IP-001h`.
   - Keep routes as documented in those plans.

2. **ID model**
   - Browser route params use **Strava activity id** as string (`activityId` path segment).
   - Convex document `_id` remains internal and optional in UI payloads.

3. **Data-fetching strategy**
   - Prefer **split read queries** per domain (activity/stream/analysis/zones/gear/voice/form series).
   - Client composes sections and handles independent loading boundaries.

4. **Voice behavior for MVP**
   - Voice is optional for MVP.
   - If audio is unavailable, omit player or render disabled state.
   - Do not assume long-lived audio URLs; fetch short-lived URLs when needed.

5. **Processing state behavior**
   - UI status system is keyed by `received -> fetching -> analyzing -> generating_audio -> complete -> error`.
   - Each screen must render explicit loading/processing/error states without blocking unrelated sections.

---

## 2) Proposed defaults to unblock frontend (pending sign-off)

These defaults are recommended so FE work can proceed consistently. Mark as approved/rejected before wiring real data.

1. **Auth/session**
   - MVP identity is Strava-linked user (`strava:<athleteId>` concept from DD-001).
   - Anonymous users can only see landing/connect experience.
   - OAuth callback redirects to `/dashboard` by default.

2. **Workout route param naming**
   - Keep route segment as `[activityId]`, but treat value as Strava id string.
   - Contract docs should refer to it as `stravaActivityId` in query args to reduce ambiguity.

3. **Week boundaries**
   - Week starts Monday.
   - Week range computed in athlete timezone from profile.
   - Persist and query using `weekStartLocal` string.

4. **Units and formatting**
   - Source of truth remains SI values in storage.
   - UI converts from SI using `athlete.measurementPreference`.
   - Optional metrics are omitted when absent; UI uses fallbacks/placeholders (not `null` checks only).

5. **Polling expectation visible to UI**
   - Plan for non-aggressive fallback polling cadence (3-5 min).
   - UI should rely on reactive updates and status fields, not client-side rapid polling.

---

## 3) Open decisions that block real data wiring

These items should be resolved before replacing mock data with Convex calls.

1. **Convex public API catalog**
   - Final query/mutation names by module (`activities`, `analyses`, `weekly`, `formSnapshots`, `files`, etc.)
   - Args and return shapes for each dashboard section

2. **OAuth browser contract**
   - Exact start/callback paths
   - Error query params shown to UI
   - `returnTo` support or fixed redirect policy
   - Reconnect flow and session failure UX

3. **Workout read model boundaries**
   - Confirm which sections compose from separate queries vs one aggregate query
   - Confirm cache and refetch expectations for stream-heavy charts

4. **Coach Status data shape**
   - Confirm split-query approach for snapshot, series, weekly load, and assessment payloads
   - Confirm minimum history behavior when fewer than 8 weeks exist

5. **Versioning policy**
   - Decide additive-only changes vs schema version field strategy for analysis payloads

---

## 4) Unified frontend build plan (no implementation yet)

### Stage A: Mock-first UI completion

1. Complete all three view layouts and section components from `IP-001f/g/h`.
2. Add deterministic mock fixtures matching proposed return shapes.
3. Validate mobile-first behavior and loading/empty/error/processing states.
4. Reuse shared primitives (`VoicePlayer`, stat card patterns, chart wrappers).

### Stage B: Contract lock

1. Publish Convex public API catalog (single contract doc, human-readable).
2. Freeze auth/session and OAuth redirect contract.
3. Freeze week/time/unit conventions in one place.
4. Update IP docs where naming still conflicts with frozen decisions.

### Stage C: Real data wiring

1. Replace fixtures with generated Convex API calls by section.
2. Keep section-level suspense/loading boundaries for resilience.
3. Wire voice URL refresh behavior for TTL-safe playback.
4. Run end-to-end manual verification across all three views.

---

## 5) Acceptance checklist for frontend readiness

- [ ] All three dashboard views render fully from mocks with mobile-responsive layouts
- [ ] Route id semantics are explicit: URL uses Strava id, internal Convex id not leaked as primary route key
- [ ] Processing statuses map to clear user-facing states on each screen
- [ ] Voice is optional and non-blocking across all views
- [ ] Week/time/unit conventions are frozen and documented
- [ ] Convex query/mutation catalog is approved for frontend consumption
- [ ] OAuth callback and reconnect UX contract is approved

---

## 6) Change log

- **2026-03-21:** Initial combined frontend contract plan created from merged reviews of `IP-001f`, `IP-001g`, `IP-001h` and contract gaps identified in `DD-001`.
