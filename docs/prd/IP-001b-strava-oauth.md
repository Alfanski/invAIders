# IP-001b: Strava OAuth Login

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)
**PRD Section:** 1.1

---

## Strava App Configuration

1. Go to `strava.com/settings/api`
2. Set Authorization Callback Domain: `localhost` (dev), `your-domain.vercel.app` (prod)
3. Required scopes: `read`, `read_all`, `activity:read_all`
4. Store `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in `.env.local`

## OAuth Flow (Step by Step)

### Step 1: "Connect with Strava" Button

- Component: `components/auth/connect-strava-button.tsx`
- Uses official Strava branding
- Links to `GET /api/auth/strava`

### Step 2: `GET /api/auth/strava` -- Build Authorization URL

1. Generate cryptographically random `state` (32 bytes hex)
2. Set `httpOnly` cookie `strava_oauth_state` with the state value
3. Redirect 302 to:

```
https://www.strava.com/oauth/authorize
  ?client_id={STRAVA_CLIENT_ID}
  &redirect_uri={STRAVA_REDIRECT_URI}
  &response_type=code
  &approval_prompt=auto
  &scope=read,read_all,activity:read_all
  &state={STATE}
```

### Step 3: `GET /api/auth/strava/callback` -- Code Exchange

1. If `error=access_denied`, redirect to `/login?error=strava_denied`
2. Validate `state` matches cookie; reject on mismatch (CSRF protection)
3. POST to `https://www.strava.com/oauth/token`:
   - `client_id`, `client_secret`, `code`, `grant_type=authorization_code`
   - Content-Type: `application/x-www-form-urlencoded`
4. Parse response: `access_token`, `refresh_token`, `expires_at`, `athlete`
5. Upsert athlete profile in Convex (via internal mutation or HTTP action)
6. Store tokens in `stravaTokens` table (server-side only, never client-readable)
7. Set session cookie (httpOnly, secure, sameSite=lax)
8. Redirect to `/dashboard`

## Token Refresh Logic

- Before any Strava API call, check `expires_at - 300 > now`
- If expired: `POST /oauth/token` with `grant_type=refresh_token`
- Atomic update: write new `accessToken`, `refreshToken`, `expiresAt` in one mutation
- Race condition handling: `tokenVersion` field; mutation checks expected version

## Session Management

**MVP decision:** Use **Convex Auth only**. Strava is a linked provider/data source
for the authenticated Convex user, not a standalone login system.

| Approach       | Decision                                                                             |
| -------------- | ------------------------------------------------------------------------------------ |
| Convex Auth    | Adopted for MVP (`useConvexAuth()` + auth subject mapping on `athletes.authSubject`) |
| Cookie session | Not used in MVP to avoid dual-auth complexity                                        |

Client never receives tokens. Only a `getStravaLinkStatus` query returning
`{ linked: boolean, athleteName, profileImage, measurementPreference }`.

## Security Checklist

- [x] Tokens never sent to client (restricted mutations only)
- [x] CSRF via `state` + cookie binding
- [x] `redirect_uri` fixed from env, never from query params
- [x] Cookies: `httpOnly`, `secure` in prod, `sameSite=lax`
- [x] n8n calls Convex with shared secret header `X-Internal-Key`

## Data Invariants

- Exactly one athlete row per authenticated app user (`athletes.authSubject`)
- Exactly one active Strava token row per athlete (`stravaTokens.athleteId`)
- Token refresh path must upsert by `athleteId` (never insert a second token row)

## Files to Create

| File                                        | Purpose                                                   |
| ------------------------------------------- | --------------------------------------------------------- |
| `app/api/auth/strava/route.ts`              | Build authorize URL, set state cookie, redirect           |
| `app/api/auth/strava/callback/route.ts`     | Exchange code, store tokens, set session                  |
| `convex/stravaTokens.ts`                    | Internal mutations: `upsertConnection`, `refreshIfNeeded` |
| `convex/athletes.ts`                        | Queries: `getStravaLinkStatus`, `getProfile`              |
| `components/auth/connect-strava-button.tsx` | Branded button                                            |
| `components/auth/auth-guard.tsx`            | Convex auth + Strava link check                           |
| `lib/strava/oauth.ts`                       | `buildAuthorizeUrl`, `exchangeCode`, `refreshTokens`      |
| `middleware.ts`                             | Protect `/dashboard/*` routes                             |

## Implementation Sequence

1. Convex schema + internal mutation for token storage + link status query
2. `lib/strava/oauth.ts` helpers (pure functions, testable)
3. `/api/auth/strava` + `/api/auth/strava/callback` routes
4. Login page + Connect button component
5. `AuthGuard` + middleware
6. Token refresh helper with `tokenVersion` strategy
7. Manual E2E test on localhost
