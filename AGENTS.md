# CoachAgent

## Overview

AI fitness coaching app. Connects to Strava, auto-analyzes workouts via Gemini,
generates visual dashboards, and delivers voice debriefs via ElevenLabs.

## Stack

- **Frontend:** Next.js 14+ (App Router) on Vercel
- **Backend/DB:** Convex (reactive, real-time subscriptions)
- **Orchestration:** n8n (webhook/polling pipeline)
- **AI:** Gemini API (coaching analysis, structured JSON output)
- **Voice:** ElevenLabs TTS
- **Data source:** Strava API v3 (OAuth 2.0)
- **UI:** shadcn/ui + Tailwind CSS + Recharts + Leaflet
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
  <!-- - **Dev**: `npm run dev` -->
  <!-- - **Build**: `npm run build` -->

## Architecture

```
Strava --> Vercel API route (webhook) --> n8n pipeline
  n8n: fetch activity --> fetch streams --> downsample
     --> Gemini (analysis) --> ElevenLabs (voice)
     --> store all in Convex

Next.js dashboard <-- Convex (reactive subscriptions)
```

### Key Data Flow

1. Strava webhook/poll detects new activity
2. n8n fetches full activity + streams from Strava API
3. Streams downsampled (30s rolling avg, ~500 points)
4. Gemini produces structured coaching JSON
5. ElevenLabs generates voice debrief audio
6. Everything stored in Convex, dashboard updates reactively

### Processing Status

Every activity record tracks its pipeline state:
`received > fetching > analyzing > generating_audio > complete > error`

## Quality Gates

| Gate             | Hook                | What runs                                                                      |
| ---------------- | ------------------- | ------------------------------------------------------------------------------ |
| **Pre-commit**   | `.husky/pre-commit` | lint-staged (ESLint --fix + Prettier on staged .ts/.tsx), Vitest related tests |
| **Pre-push**     | `.husky/pre-push`   | Full type-check (tsc --noEmit), full test suite                                |
| **CI (planned)** | GitHub Actions      | validate (type-check + lint + format:check + test:run)                         |

### Tooling

- **ESLint** -- flat config (`eslint.config.mjs`), strict + stylistic type-checked rules
- **Prettier** -- formatting (`.prettierrc.json`), runs via lint-staged and Cursor hook
- **TypeScript** -- strict mode + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes`
- **Vitest** -- unit tests, 80% coverage thresholds enforced
- **Husky** -- git hooks (pre-commit, pre-push)
- **lint-staged** -- runs linters only on staged files for fast commits

## Key Patterns

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

## Strava API Limits

100 requests per 15 minutes, 1000 per day. Plan API calls carefully.

## Documentation

| Path                  | Purpose                               |
| --------------------- | ------------------------------------- |
| `docs/index.md`       | Central documentation hub             |
| `docs/design/DD-*.md` | Architecture & technical design docs  |
| `docs/prd/PRD-*.md`   | Product requirements documents        |
| `AGENTS.md`           | This file -- cross-tool agent context |
| `tasks/lessons.md`    | Corrections and patterns learned      |
| `tasks/lessons-pr.md` | PR review patterns                    |
| `.cursor/rules/*.mdc` | File-scoped coding rules              |

## Agent Framework

Eclipse Agentic Framework (v0.1.0). Skills: implement, debug, refactor,
test, pr-review, create-prd, compound, audit-docs, resolve-pr-feedback, research.
