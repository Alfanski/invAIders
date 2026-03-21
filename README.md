# mAIcoach

AI fitness coaching app. Connects to Strava, analyzes workouts via Gemini, generates visual dashboards, and delivers voice debriefs via ElevenLabs.

**Stack:** Next.js 16 (App Router) + Convex + Tailwind CSS + Recharts + Leaflet + Gemini + ElevenLabs

## Prerequisites

- Node.js 20+
- npm
- A [Strava](https://www.strava.com) account
- A [Convex](https://www.convex.dev) account

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

When deploying to Vercel, update the **Authorization Callback Domain** on your Strava API app to your production domain (e.g. `coachagent.vercel.app`) and set `STRAVA_REDIRECT_URI` accordingly.

## Environment Variables Reference

| Variable                 | Required | Where to get it                                                |
| ------------------------ | -------- | -------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | Yes      | Auto-set by `npx convex dev`                                   |
| `STRAVA_CLIENT_ID`       | Yes      | [strava.com/settings/api](https://www.strava.com/settings/api) |
| `STRAVA_CLIENT_SECRET`   | Yes      | Same page, click "show"                                        |
| `STRAVA_REDIRECT_URI`    | Yes      | `http://localhost:3000/api/auth/strava/callback` for local dev |
| `SESSION_SECRET`         | Yes      | Self-generated (see above)                                     |
| `GEMINI_API_KEY`         | Later    | [ai.google.dev](https://ai.google.dev)                         |
| `ELEVENLABS_API_KEY`     | Later    | [elevenlabs.io](https://elevenlabs.io)                         |
| `ELEVENLABS_VOICE_ID`    | Later    | ElevenLabs voice library                                       |
| `CONVEX_WEBHOOK_SECRET`  | Later    | Self-generated, shared with n8n                                |

## Commands

| Command              | Purpose                                  |
| -------------------- | ---------------------------------------- |
| `npm run dev`        | Start Next.js dev server                 |
| `npm run build`      | Production build                         |
| `npm run lint`       | ESLint check                             |
| `npm run format`     | Prettier format                          |
| `npm run type-check` | TypeScript strict check                  |
| `npm run test`       | Vitest (watch mode)                      |
| `npm run test:run`   | Vitest (single run)                      |
| `npm run validate`   | All checks (type + lint + format + test) |

## Documentation

See [docs/index.md](docs/index.md) for the full documentation hub (PRDs, design docs, implementation plans).
