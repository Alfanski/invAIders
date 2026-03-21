# IP-001a: Project Scaffolding

**Status:** Draft
**Parent:** [IP-001-coachagent-mvp.md](IP-001-coachagent-mvp.md)

---

## 0.1 Initialize Next.js

```bash
cd /Users/cschafer002/Documents/repos/invAIders
npx create-next-app@latest . --typescript --tailwind --eslint --app --import-alias "@/*" --use-npm
```

If the CLI warns about a non-empty directory, confirm or temporarily move
`docs/`, `tasks/`, `AGENTS.md` aside, scaffold, then restore.

## 0.2 Add Convex

```bash
npm install convex
npx convex dev
```

First run creates `convex/` with `_generated/` and prompts for deployment login.
Wire `ConvexClientProvider` in `app/providers.tsx` + `app/layout.tsx`.

## 0.3 Install Dependencies

**UI framework:**

```bash
npx shadcn@latest init
npx shadcn@latest add button card input label tabs badge separator \
  scroll-area sheet dialog dropdown-menu avatar skeleton toast sonner \
  table progress slider select textarea accordion popover tooltip
```

**Charts, maps, utilities:**

```bash
npm install recharts leaflet react-leaflet date-fns zod
npm install -D @types/leaflet
```

## 0.4 Target Directory Structure

```
.
├── app/
│   ├── layout.tsx
│   ├── page.tsx                        # Landing / login
│   ├── globals.css
│   ├── providers.tsx                   # ConvexProvider, theme
│   ├── dashboard/
│   │   ├── layout.tsx                  # Auth gate + tab bar
│   │   ├── page.tsx                    # View A: last workout
│   │   ├── workout/[activityId]/page.tsx
│   │   ├── week/page.tsx               # View B
│   │   └── form/page.tsx               # View C
│   └── api/
│       ├── auth/
│       │   └── strava/
│       │       ├── route.ts           # Initiate OAuth
│       │       └── callback/route.ts  # Handle callback
│       └── webhooks/
│           └── strava/route.ts        # Webhook GET+POST
├── components/
│   ├── ui/                            # shadcn primitives only
│   ├── providers/
│   │   └── convex-client-provider.tsx
│   ├── dashboard/
│   │   ├── stat-card.tsx
│   │   ├── stat-card-grid.tsx
│   │   ├── splits-table.tsx
│   │   └── workout-header.tsx
│   ├── charts/
│   │   ├── hr-area-chart.tsx
│   │   ├── pace-line-chart.tsx
│   │   ├── zone-distribution.tsx
│   │   ├── ctl-atl-tsb-chart.tsx
│   │   ├── weekly-load-chart.tsx
│   │   └── elevation-profile.tsx
│   ├── maps/
│   │   ├── route-map.tsx              # Dynamic import wrapper
│   │   └── route-map-inner.tsx
│   ├── audio/
│   │   └── voice-player.tsx
│   ├── form/
│   │   ├── form-gauge.tsx
│   │   ├── metric-cards.tsx
│   │   ├── recovery-indicator.tsx
│   │   └── progression-sparklines.tsx
│   ├── auth/
│   │   ├── connect-strava-button.tsx
│   │   └── auth-guard.tsx
│   └── layout/
│       ├── app-header.tsx
│       └── dashboard-tab-bar.tsx
├── convex/
│   ├── schema.ts
│   ├── http.ts                        # Inbound webhooks from n8n
│   ├── athletes.ts
│   ├── stravaTokens.ts               # Internal-only mutations
│   ├── activities.ts
│   ├── streams.ts
│   ├── analyses.ts
│   ├── voiceDebriefs.ts
│   ├── zones.ts
│   ├── gear.ts
│   ├── weekly.ts
│   ├── formSnapshots.ts
│   └── files.ts                      # Storage URL queries
├── lib/
│   ├── strava/
│   │   ├── oauth.ts                  # URL builder, code exchange, refresh
│   │   ├── client.ts                 # Fetch wrappers
│   │   └── constants.ts
│   ├── coaching/
│   │   ├── trimp.ts
│   │   ├── ctl-atl-tsb.ts
│   │   └── zones.ts
│   ├── ai/
│   │   └── prompts/
│   │       ├── activity-analysis.ts
│   │       ├── weekly-analysis.ts
│   │       └── form-assessment.ts
│   ├── charts/
│   │   ├── hr-zones.ts
│   │   └── theme.ts
│   ├── units.ts                      # Pace, speed, distance, temp
│   ├── format.ts                     # Date/time formatting
│   ├── week-boundaries.ts
│   └── utils.ts                      # cn() helper
├── types/
│   ├── strava.ts
│   ├── gemini-analysis.ts
│   ├── dashboard.ts
│   └── processing-status.ts
└── .env.local.example
```

## 0.5 Environment Variables Template

```bash
# --- Convex ---
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud

# --- Strava OAuth ---
STRAVA_CLIENT_ID=
STRAVA_CLIENT_SECRET=
STRAVA_REDIRECT_URI=http://localhost:3000/api/auth/strava/callback
STRAVA_WEBHOOK_VERIFY_TOKEN=

# --- n8n ---
N8N_STRAVA_WEBHOOK_URL=

# --- Gemini ---
GEMINI_API_KEY=

# --- ElevenLabs ---
ELEVENLABS_API_KEY=
ELEVENLABS_VOICE_ID=

# --- Internal secrets ---
CONVEX_WEBHOOK_SECRET=
```

## 0.6 Tailwind Theme Customization

Extend `tailwind.config.ts` with HR zone and fitness model tokens:

```ts
colors: {
  zone: {
    z1: "#cbd5e1",  // gray
    z2: "#93c5fd",  // blue
    z3: "#34d399",  // green
    z4: "#fbbf24",  // amber
    z5: "#f87171",  // red
  },
  coach: {
    ctl: "#2563eb",  // blue (fitness)
    atl: "#dc2626",  // red (fatigue)
    tsb: "#16a34a",  // green (form)
  },
},
```

## 0.7 Implementation Sequence

1. `create-next-app` + verify `npm run dev`
2. `npx convex dev` + `convex/schema.ts` (see overview for full schema)
3. Regenerate Convex types (`_generated/dataModel`)
4. `ConvexClientProvider` + `app/providers.tsx` + `app/layout.tsx`
5. Stub Convex query (e.g. `activities.listForAthlete` returning `[]`) to prove wiring
6. `types/processing-status.ts`, `types/strava.ts`, `types/gemini-analysis.ts`
7. shadcn `init` + core components
8. `lib/coaching/trimp.ts` + `lib/charts/hr-zones.ts` (pure functions, testable early)
