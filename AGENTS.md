# CoachAgent

## Overview

AI fitness coaching app. Connects to Strava, auto-analyzes workouts via
OpenAI-compatible LLM (Groq / Llama 3.3 70B by default), generates visual
dashboards, and delivers voice debriefs via ElevenLabs.

## Stack

- **Frontend:** Next.js 14+ (App Router) on Vercel
- **Backend/DB:** Convex (reactive, real-time subscriptions)
- **Orchestration:** n8n (webhook/polling pipeline)
- **AI:** OpenAI-compatible API via Groq (Llama 3.3 70B, coaching analysis, structured JSON)
- **Voice:** ElevenLabs TTS
- **Data source:** Strava API v3 (OAuth 2.0)
- **UI:** Custom glassmorphism design system + Tailwind CSS v4 + Recharts + Leaflet
- **Language:** TypeScript throughout

## Commands

- **Lint**: `npm run lint` (ESLint with strict TypeScript rules)
- **Lint fix**: `npm run lint:fix`
- **Format**: `npm run format` (Prettier)
- **Format check**: `npm run format:check`
- **Type check**: `npm run type-check` (tsc --noEmit, strict mode)
- **Test**: `npm run test` (Vitest, watch mode)
- **Test run**: `npm run test:run` (Vitest, single run for CI)
- **Test coverage**: `npm run test:coverage` (80% threshold enforced)
- **Validate all**: `npm run validate` (type-check + lint + format + test)
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **n8n list**: `npm run n8n:list` (list workflows on n8n Cloud)
- **n8n pull**: `npm run n8n:pull` (pull all workflows to `n8n/workflows/`)
- **n8n push**: `npm run n8n:push` (push all workflow JSON to n8n Cloud)
- **n8n credentials**: `npm run n8n:credentials` (list credential IDs on Cloud)

## Architecture

```
Strava --> Vercel API route (webhook) --> n8n pipeline
 n8n: fetch activity --> fetch streams --> downsample
 --> LLM/Groq (analysis) --> ElevenLabs (voice)
 --> store all in Convex

Next.js dashboard <-- Convex (reactive subscriptions)
```

### n8n Cloud (Orchestration)

- **Instance:** `https://lorenzo-hackathon.app.n8n.cloud`
- **Auth:** API key in `.env.local` (`N8N_BASE_URL` + `N8N_API_KEY`)
- **IaC:** Workflow JSON files in `n8n/workflows/`, deployed via REST API
- **Sync:** `npm run n8n:push` / `npm run n8n:pull` (wraps `.cursor/skills/n8n-workflow/sync.sh`)
- **Skill:** `.cursor/skills/n8n-workflow/SKILL.md` for creating/editing/deploying workflows
- **Rule:** `.cursor/rules/n8n.mdc` (auto-loaded for `n8n/**` files)

Agents source `.env.local` before making direct API calls:

```bash
source .env.local
curl -s -H "X-N8N-API-KEY: $N8N_API_KEY" "$N8N_BASE_URL/api/v1/workflows"
```

### Vercel Deployment

| Project    | Branch | URL                           |
| ---------- | ------ | ----------------------------- |
| `maicoach` | `main` | `https://maicoach.vercel.app` |

- **Team:** `lorenzohackathon-invaiders`
- **Git Integration:** Auto-deploys on push to `main`
- **Env vars for preview scope:** CLI has a bug (v50+), use REST API instead (see `tasks/lessons.md`)

### CI/CD (GitHub Actions)

Two workflows in `.github/workflows/`:

- **`ci.yml`** — Runs `npm run validate` on pull requests to `main`.
- **`deploy.yml`** — On push to `main`: validates, deploys Convex
  (`scripts/deploy-prod.sh`), syncs env vars to Vercel
  (`scripts/sync-vercel-env.sh`), and pushes n8n workflow JSON (only when
  `n8n/` files changed). Vercel deploys automatically via Git Integration.

**Required GitHub Secrets** (repo → Settings → Secrets → Actions):

| Secret                        | Purpose                         |
| ----------------------------- | ------------------------------- |
| `CONVEX_DEPLOY_KEY`           | Convex production deploy key    |
| `STRAVA_CLIENT_ID`            | Convex + Vercel env var         |
| `STRAVA_CLIENT_SECRET`        | Convex + Vercel env var         |
| `GROQ_API_KEY`                | Convex + Vercel env var (LLM)   |
| `CONVEX_WEBHOOK_SECRET`       | Convex env var                  |
| `SESSION_SECRET`              | Convex + Vercel env var         |
| `ELEVENLABS_API_KEY`          | Convex env var                  |
| `ELEVENLABS_VOICE_ID`         | Convex env var                  |
| `N8N_STRAVA_WEBHOOK_URL`      | Convex + Vercel env var         |
| `APP_URL`                     | Convex env var                  |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Vercel env var                  |
| `N8N_BASE_URL`                | n8n Cloud instance URL          |
| `N8N_API_KEY`                 | n8n Cloud API key               |
| `VERCEL_TOKEN`                | Vercel API token (env var sync) |
| `VERCEL_PROJECT_ID`           | Vercel project ID (`prj_...`)   |
| `VERCEL_TEAM_ID`              | Vercel team ID (`team_...`)     |

### Strava Webhook

- **Endpoint:** `https://maicoach.vercel.app/api/webhooks/strava`
- **Route:** `app/api/webhooks/strava/route.ts`
- **Subscription ID:** `336243`
- **Verify token:** stored in `STRAVA_WEBHOOK_VERIFY_TOKEN` env var

**GET** — Strava subscription validation (hub challenge handshake).
**POST** — Receives activity events, filters for `activity/create`, forwards to n8n via fire-and-forget `fetch()`.

Env vars required on the Vercel project:

- `STRAVA_WEBHOOK_VERIFY_TOKEN` — matches the token used during subscription registration
- `N8N_STRAVA_WEBHOOK_URL` — n8n webhook endpoint to forward activity events to

### Key Data Flow

1. Strava webhook/poll detects new activity
2. n8n fetches full activity + streams from Strava API
3. Streams downsampled (30s rolling avg, ~500 points)
4. LLM (Groq/Llama 3.3) produces structured coaching JSON
5. ElevenLabs generates voice debrief audio
6. Everything stored in Convex, dashboard updates reactively

### Processing Status

Every activity record tracks its pipeline state:
`received > fetching > analyzing > generating_audio > complete > error`

## Quality Gates

| Gate           | Hook                           | What runs                                                                      |
| -------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| **Pre-commit** | `.husky/pre-commit`            | lint-staged (ESLint --fix + Prettier on staged .ts/.tsx), Vitest related tests |
| **Pre-push**   | `.husky/pre-push`              | Full type-check (tsc --noEmit), full test suite                                |
| **CI (PR)**    | `.github/workflows/ci.yml`     | validate (type-check + lint + format:check + test:run)                         |
| **CD (main)**  | `.github/workflows/deploy.yml` | validate → deploy Convex → deploy n8n workflows                                |

### Tooling

- **ESLint** -- flat config (`eslint.config.mjs`), strict + stylistic type-checked rules
- **Prettier** -- formatting (`.prettierrc.json`), runs via lint-staged and Cursor hook
- **TypeScript** -- strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **Vitest** -- unit tests, 80% coverage thresholds enforced
- **Husky** -- git hooks (pre-commit, pre-push)
- **lint-staged** -- runs linters only on staged files for fast commits

## TDD Workflow

Write tests **before or alongside** implementation. Every PR that adds logic
must include tests.

### Test-first cycle

1. **Red** -- write a failing test that describes the expected behaviour.
2. **Green** -- write the minimum code to make it pass.
3. **Refactor** -- clean up while all tests stay green.
4. Run `npm run test:run` (single run) or `npm run test` (watch) after each
   change.

### What to test

| Layer                                | Tool                                             | Pattern                                                                   |
| ------------------------------------ | ------------------------------------------------ | ------------------------------------------------------------------------- |
| Pure helpers (`lib/`, `convex/lib/`) | Vitest                                           | Direct import, no mocks needed                                            |
| Functions that call `fetch`          | Vitest + `vi.fn()` / `vi.spyOn(global, 'fetch')` | Mock fetch, assert URL/headers/body, return fixture                       |
| Convex mutations/queries             | Convex test harness (future)                     | For now, test extracted pure logic; integration coverage via manual + E2E |
| React components                     | Vitest + Testing Library (future)                | Render, assert DOM, simulate events                                       |
| E2E flows                            | Playwright (`e2e/`)                              | Full browser, separate from `npm run test`                                |

### Conventions

- Test files live **next to** the file they test: `foo.ts` -> `foo.test.ts`.
- Use `describe` blocks grouped by function/method name.
- Use `it` with behaviour-first phrasing: `it('returns "run" for TrailRun sport type')`.
- Prefer concrete assertions (`toBe`, `toEqual`, `toContain`) over loose ones
  (`toBeTruthy`).
- Mock only external boundaries (network, DB). Never mock the unit under test.
- Coverage thresholds: 80% statements/branches/functions/lines (enforced in
  `vitest.config.ts`).

### Running tests

```bash
npm run test          # watch mode (dev)
npm run test:run      # single run (CI / pre-push)
npm run test:coverage # with 80% threshold enforcement
```

## Key Patterns

- UI follows glassmorphism design system (`.cursor/rules/ui-design-system.mdc`)
- Dark/light theme via `next-themes` (class strategy, default dark, system-aware)
- Three glass surface tiers: `glass-panel`, `glass-panel-elevated`, `glass-card`
- All custom colors defined as `@theme` tokens in `app/globals.css` (Tailwind v4)
- Theme-sensitive CSS vars in `:root` (light) / `.dark` (dark), `@theme` refs them
- `@variant dark` enables `dark:` prefix for one-off overrides
- No icon library -- inline SVG only (Heroicons-style paths)
- No shadcn/ui -- custom components using glass panel system
- Strava tokens stored server-side only (Convex restricted table)
- Streams always downsampled before AI -- never send raw 10K-point arrays
- TRIMP computed per activity for training load tracking
- CTL/ATL/TSB (Fitness-Fatigue model) computed from TRIMP history
- Activity type branching: Run vs Ride vs other (different metrics)
- ElevenLabs audio downloaded to Convex file storage (temp URLs expire)

## Anti-Patterns

- Never expose Strava tokens to the client
- Never send raw streams to Gemini (token waste, no quality improvement)
- Don't call it "Body Battery" (Garmin trademark) -- use "Coach Status"
- Don't rely on `suffer_score` alone (premium-only) -- compute TRIMP as fallback
- Don't use `text-white` for primary text -- use `text-glass-text` (theme-aware)
- Don't hardcode dark surface colors (`#0c0a1a`, `#1a1830`) -- use CSS vars
- Don't install shadcn/ui or icon packages -- use existing glass + inline SVG patterns

## Strava API

### Rate Limits

100 requests per 15 minutes, 1000 per day. Plan API calls carefully.

### Webhook Subscription

Registered via:

```bash
set -a && source .env.local && set +a
curl -X POST https://www.strava.com/api/v3/push_subscriptions \
 -d "client_id=$STRAVA_CLIENT_ID" \
 -d "client_secret=$STRAVA_CLIENT_SECRET" \
 -d "callback_url=https://maicoach.vercel.app/api/webhooks/strava" \
 -d "verify_token=$STRAVA_WEBHOOK_VERIFY_TOKEN"
```

To list existing subscriptions:

```bash
curl -s "https://www.strava.com/api/v3/push_subscriptions?client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET"
```

To delete a subscription:

```bash
curl -X DELETE "https://www.strava.com/api/v3/push_subscriptions/336243?client_id=$STRAVA_CLIENT_ID&client_secret=$STRAVA_CLIENT_SECRET"
```

## Documentation

| Path                   | Purpose                                     |
| ---------------------- | ------------------------------------------- |
| `docs/index.md`        | Central documentation hub                   |
| `docs/design/DD-*.md`  | Architecture & technical design docs        |
| `docs/prd/PRD-*.md`    | Product requirements documents              |
| `AGENTS.md`            | This file -- cross-tool agent context       |
| `tasks/lessons.md`     | Corrections and patterns learned            |
| `tasks/lessons-pr.md`  | PR review patterns                          |
| `.cursor/rules/*.mdc`  | File-scoped coding rules                    |
| `n8n/workflows/*.json` | Version-controlled n8n workflow definitions |

## Agent Framework

Eclipse Agentic Framework (v0.1.0). Skills: implement, debug, refactor,
test, pr-review, create-prd, compound, audit-docs, resolve-pr-feedback,
research, **n8n-workflow**, **vercel-runtime-logs**, **strava-manual-sync**,
**convex-delete-documents**.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read `convex/_generated/ai/guidelines.md` first** for important guidelines on how to correctly use Convex APIs and patterns. The file contains rules that override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running `npx convex ai-files install`.

<!-- convex-ai-end -->
