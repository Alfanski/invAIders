# mAIcoach

AI fitness coaching app. Connects to Strava, auto-analyzes workouts via LLM, generates visual dashboards, and delivers voice debriefs via ElevenLabs.

**Stack:** Next.js 16 (App Router) · Convex · n8n · Groq (Llama 3.3 70B) · ElevenLabs · Tailwind CSS v4 · Recharts · Leaflet

## Prerequisites

- Node.js 20+
- npm
- A [Strava](https://www.strava.com) account with an [API application](https://www.strava.com/settings/api)
- A [Convex](https://www.convex.dev) account
- A [Groq](https://console.groq.com) account (free tier works)
- An [n8n Cloud](https://n8n.io) instance (orchestration pipeline)
- An [ElevenLabs](https://elevenlabs.io) account (voice debriefs, optional)

## Getting Started

```bash
git clone <repo-url>
cd invAIders
npm install
cp .env.local.example .env.local
```

Then fill in `.env.local` following the sections below.

## Strava OAuth Setup (Local Dev)

### 1. Create a Strava API Application

1. Log in to [strava.com](https://www.strava.com)
2. Go to **[strava.com/settings/api](https://www.strava.com/settings/api)**
3. Click **"Create an App"** (or edit your existing one)
4. Fill in the form:

   | Field                         | Value                    |
   | ----------------------------- | ------------------------ |
   | Application Name              | `mAIcoach` (or any name) |
   | Category                      | `Training`               |
   | Club                          | _(leave blank)_          |
   | Website                       | `http://localhost:3000`  |
   | Authorization Callback Domain | `localhost`              |

5. Click **Create**

### 2. Copy Your Credentials

On the API settings page you'll now see:

- **Client ID** -- a numeric ID (e.g. `12345`)
- **Client Secret** -- click "show" to reveal a long hex string

Copy both into `.env.local`:

```
STRAVA_CLIENT_ID=12345
STRAVA_CLIENT_SECRET=your_secret_here
```

The redirect URI is pre-configured for local dev:

```
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback
```

### 3. Generate a Session Secret

The session cookie is HMAC-signed. Generate a random key:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Paste the output into `.env.local`:

```
SESSION_SECRET=<64-char hex string>
```

### 4. Set Up Convex

If you haven't initialized Convex yet:

```bash
npx convex dev
```

This will prompt you to log in and create a project. It writes `CONVEX_DEPLOYMENT` and `NEXT_PUBLIC_CONVEX_URL` to `.env.local` automatically.

If Convex is already set up, just make sure `NEXT_PUBLIC_CONVEX_URL` is present in `.env.local`.

### Team Setup (Shared Deployment)

To share a single Convex deployment so everyone works against the same data:

1. **One person** initializes the project with `npx convex dev` (see above)
2. Share these values from your `.env.local` with the team:
   ```
   CONVEX_DEPLOYMENT=dev:fine-ibex-73
   NEXT_PUBLIC_CONVEX_URL=https://fine-ibex-73.eu-west-1.convex.cloud
   CONVEX_DEPLOY_KEY=<dev deploy key>
   ```
3. Generate the `CONVEX_DEPLOY_KEY` from the [Convex dashboard](https://dashboard.convex.dev) → Project Settings → Deploy Key
4. Invite teammates to the project via the dashboard (Settings → Members) so they can view tables and logs

**Important: only one person should run `npx convex dev` at a time.** The file watcher pushes schema and functions on every save — multiple watchers will overwrite each other, causing unpredictable behavior. Everyone else should:

- Run only `npx next dev` for the frontend (it connects to the shared Convex URL)
- Use `npx convex dev --once` when they need to push a backend change
- Pull the latest code from git before pushing to avoid overwriting

### 5. Run the App

```bash
npm run dev
```

Visit `http://localhost:3000` and click **"Connect with Strava"**. The OAuth flow will:

1. Redirect you to Strava to authorize the app
2. Strava calls back to `/api/auth/strava/callback`
3. The callback exchanges the code for tokens, stores them in Convex, and sets a session cookie
4. You're redirected to `/dashboard`

### Production Callback Domain

When deploying to Vercel, update the **Authorization Callback Domain** on your Strava API app to your production domain (e.g. `maicoach.vercel.app`) and set `STRAVA_REDIRECT_URI` accordingly.

## Architecture

```
Strava  ──webhook──▸  Vercel API route  ──forward──▸  n8n pipeline
                                                        │
                      ┌─────────────────────────────────┘
                      ▼
               Fetch activity + streams from Strava API
                      │
                      ▼
               Downsample streams (30s rolling avg, ~500 pts)
                      │
                      ▼
               LLM analysis (Groq / Llama 3.3 70B)
                      │
                      ▼
               ElevenLabs TTS (voice debrief)
                      │
                      ▼
               Store everything in Convex
                      │
                      ▼
        Next.js dashboard  ◂──reactive subscriptions──  Convex
```

**Key data flow:** Strava webhook fires on new activity → Vercel forwards to n8n → n8n fetches full data, runs LLM analysis, generates voice debrief → results stored in Convex → dashboard updates in real-time via Convex subscriptions.

Each activity tracks its pipeline state: `received` → `fetching` → `analyzing` → `generating_audio` → `complete` (or `error`).

## Deployment

| Component          | URL / Details                                             |
| ------------------ | --------------------------------------------------------- |
| **Vercel**         | [`maicoach.vercel.app`](https://maicoach.vercel.app)      |
| **Convex**         | Reactive backend, auto-deployed via CI                    |
| **n8n Cloud**      | Orchestration pipeline, workflows in `n8n/workflows/`     |
| **Strava Webhook** | Subscription ID `336243`, endpoint `/api/webhooks/strava` |

### CI/CD (GitHub Actions)

- **`ci.yml`** — Runs `npm run validate` on pull requests to `main`
- **`deploy.yml`** — On push to `main`: validates, deploys Convex, syncs env vars to Vercel, syncs n8n variables, and pushes n8n workflows (when `n8n/` files change). Vercel deploys automatically via Git Integration.

## Environment Variables Reference

Copy `.env.local.example` to `.env.local` and fill in the values.

| Variable                      | Required | Where to get it                                                          |
| ----------------------------- | -------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_CONVEX_URL`      | Yes      | Auto-set by `npx convex dev`                                             |
| `CONVEX_DEPLOY_KEY`           | Yes      | [Convex dashboard](https://dashboard.convex.dev) → Deploy Key            |
| `STRAVA_CLIENT_ID`            | Yes      | [strava.com/settings/api](https://www.strava.com/settings/api)           |
| `STRAVA_CLIENT_SECRET`        | Yes      | Same page, click "show"                                                  |
| `STRAVA_REDIRECT_URI`         | Yes      | `http://localhost:3000/api/auth/strava/callback` for local dev           |
| `STRAVA_WEBHOOK_VERIFY_TOKEN` | Yes      | Self-generated, used when registering Strava webhook subscription        |
| `SESSION_SECRET`              | Yes      | Self-generated (see [step 3](#3-generate-a-session-secret))              |
| `GROQ_API_KEY`                | Yes      | [console.groq.com](https://console.groq.com)                             |
| `N8N_BASE_URL`                | Yes      | Your n8n Cloud instance URL (e.g. `https://your-instance.app.n8n.cloud`) |
| `N8N_API_KEY`                 | Yes      | n8n Cloud → Settings → API                                               |
| `N8N_STRAVA_WEBHOOK_URL`      | Yes      | n8n webhook trigger URL for the Strava pipeline                          |
| `CONVEX_WEBHOOK_SECRET`       | Yes      | Self-generated, shared between Convex and n8n                            |
| `INTERNAL_API_TOKEN`          | Yes      | Self-generated, authenticates n8n → Vercel API calls                     |
| `APP_URL`                     | Yes      | `http://localhost:3000` (dev) or production Vercel URL                   |
| `ELEVENLABS_API_KEY`          | Optional | [elevenlabs.io](https://elevenlabs.io) (voice debriefs)                  |
| `ELEVENLABS_VOICE_ID`         | Optional | ElevenLabs voice library                                                 |
| `VERCEL_TOKEN`                | Optional | [vercel.com/account/tokens](https://vercel.com/account/tokens) (CLI)     |

## Commands

| Command                        | Purpose                                  |
| ------------------------------ | ---------------------------------------- |
| `npm run dev`                  | Start Next.js dev server                 |
| `npm run build`                | Production build                         |
| `npm run lint`                 | ESLint check                             |
| `npm run lint:fix`             | ESLint with auto-fix                     |
| `npm run format`               | Prettier format all files                |
| `npm run format:check`         | Prettier check (CI)                      |
| `npm run type-check`           | TypeScript strict check (`tsc --noEmit`) |
| `npm run test`                 | Vitest (watch mode)                      |
| `npm run test:run`             | Vitest (single run, CI)                  |
| `npm run test:coverage`        | Vitest with 80% coverage threshold       |
| `npm run test:e2e`             | Playwright end-to-end tests              |
| `npm run test:e2e:ui`          | Playwright with interactive UI           |
| `npm run validate`             | All checks (type + lint + format + test) |
| `npm run n8n:list`             | List workflows on n8n Cloud              |
| `npm run n8n:pull`             | Pull all workflows to `n8n/workflows/`   |
| `npm run n8n:push`             | Push workflow JSON to n8n Cloud          |
| `npm run n8n:credentials`      | List credential IDs on n8n Cloud         |
| `npm run strava:test-activity` | Upload a test activity to Strava         |

## Documentation

See [docs/index.md](docs/index.md) for the full documentation hub (PRDs, design docs, implementation plans).
