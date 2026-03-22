/**
 * Seeds 5 realistic activities on Strava over the last week.
 * Uploads FIT files with GPS tracks, heart rate, cadence, and elevation.
 * Represents a peak training week for a fit runner/cyclist.
 *
 * Usage:
 *   npx tsx scripts/strava-seed-activities.ts
 *   npx tsx scripts/strava-seed-activities.ts --dry-run

 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOKEN_FILE = resolve(ROOT, '.strava-tokens.json');
const ENV_FILE = resolve(ROOT, '.env.local');
const CALLBACK_PORT = 8888;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

const RATE_LIMIT_MAX = 85; // stay under 100/15min
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;

// ---------------------------------------------------------------------------
// Env loading
// ---------------------------------------------------------------------------

function loadEnv(): Record<string, string> {
  if (!existsSync(ENV_FILE)) {
    throw new Error(`.env.local not found at ${ENV_FILE}`);
  }
  const env: Record<string, string> = {};
  for (const line of readFileSync(ENV_FILE, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    env[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return env;
}

// ---------------------------------------------------------------------------
// Token management
// ---------------------------------------------------------------------------

interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

function loadTokens(): StravaTokens | null {
  if (!existsSync(TOKEN_FILE)) return null;
  try {
    return JSON.parse(readFileSync(TOKEN_FILE, 'utf-8')) as StravaTokens;
  } catch {
    return null;
  }
}

function saveTokens(tokens: StravaTokens): void {
  writeFileSync(TOKEN_FILE, JSON.stringify(tokens, null, 2) + '\n');
  console.log('💾 Tokens saved to .strava-tokens.json');
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokens> {
  console.log('🔄 Refreshing access token...');
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as StravaTokens;
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };
}

// ---------------------------------------------------------------------------
// OAuth authorization flow
// ---------------------------------------------------------------------------

function openBrowser(url: string): void {
  try {
    execSync(`open "${url}"`, { stdio: 'ignore' });
  } catch {
    console.log(`\n🌐 Open this URL in your browser:\n${url}\n`);
  }
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolve, reject) => {
    const server = createServer((req: IncomingMessage, res: ServerResponse) => {
      const url = new URL(req.url ?? '/', `http://localhost:${CALLBACK_PORT}`);
      if (url.pathname !== '/callback') {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const code = url.searchParams.get('code');
      const error = url.searchParams.get('error');
      if (error) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization denied</h1><p>You can close this tab.</p>');
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }
      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html' });
        res.end('<h1>Missing code</h1>');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<h1>✅ Authorized!</h1><p>You can close this tab.</p>');
      server.close();
      resolve(code);
    });
    server.listen(CALLBACK_PORT, () => {
      console.log(
        `🔑 Waiting for OAuth callback on http://localhost:${CALLBACK_PORT}/callback ...`,
      );
    });
    server.on('error', reject);
  });
}

async function authorize(clientId: string, clientSecret: string): Promise<StravaTokens> {
  const authUrl = new URL('https://www.strava.com/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'activity:write,activity:read_all,profile:read_all');
  authUrl.searchParams.set('approval_prompt', 'force');
  console.log('\n🔐 Opening Strava authorization page...');
  openBrowser(authUrl.toString());
  const code = await waitForAuthCode();
  console.log('✅ Authorization code received, exchanging for tokens...');
  const res = await fetch('https://www.strava.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${body}`);
  }
  const data = (await res.json()) as StravaTokens & {
    athlete?: { id: number; firstname: string };
  };
  if (data.athlete) {
    console.log(`👤 Authenticated as: ${data.athlete.firstname} (ID: ${data.athlete.id})`);
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };
}

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  let tokens = loadTokens();
  if (!tokens) {
    console.log('No cached tokens found — starting OAuth flow...');
    tokens = await authorize(clientId, clientSecret);
    saveTokens(tokens);
    return tokens.access_token;
  }
  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expires_at <= nowSec + 60) {
    tokens = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
    saveTokens(tokens);
  } else {
    const minLeft = Math.round((tokens.expires_at - nowSec) / 60);
    console.log(`✅ Using cached token (expires in ${minLeft} min)`);
  }
  return tokens.access_token;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

const requestTimestamps: number[] = [];

async function rateLimitedFetch(url: string, init: RequestInit): Promise<Response> {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  // Prune old timestamps
  while (requestTimestamps.length > 0 && requestTimestamps[0]! < windowStart) {
    requestTimestamps.shift();
  }

  if (requestTimestamps.length >= RATE_LIMIT_MAX) {
    const oldestInWindow = requestTimestamps[0]!;
    const waitMs = oldestInWindow + RATE_LIMIT_WINDOW_MS - now + 5000;
    const waitMin = Math.ceil(waitMs / 60000);
    console.log(
      `\n⏸️  Rate limit approaching (${requestTimestamps.length}/${RATE_LIMIT_MAX}). Pausing ${waitMin} min...`,
    );
    await sleep(waitMs);
  }

  requestTimestamps.push(Date.now());
  const res = await fetch(url, init);

  if (res.status === 429) {
    const retryAfter = res.headers.get('retry-after');
    const waitSec = retryAfter ? parseInt(retryAfter, 10) : 900;
    console.log(`\n⚠️  429 Rate limited by Strava. Waiting ${waitSec}s...`);
    await sleep(waitSec * 1000);
    return rateLimitedFetch(url, init);
  }

  return res;
}

// ---------------------------------------------------------------------------
// Seeded random for reproducibility
// ---------------------------------------------------------------------------

let seed = 42;
function seededRandom(): number {
  seed = (seed * 1664525 + 1013904223) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randBetween(min: number, max: number): number {
  return min + seededRandom() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(randBetween(min, max + 1));
}
function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(seededRandom() * arr.length)]!;
}

// ---------------------------------------------------------------------------
// Activity planning
// ---------------------------------------------------------------------------

interface PlannedActivity {
  name: string;
  sport_type: string;
  type: string;
  startTime: Date;
  elapsed_time: number;
  distance: number;
  description: string;
  trainer: number;
  commute: number;
  category: string;
  progress: number; // 0..1 through the training block
}

type ActivityTemplate = {
  sport_type: string;
  type: string;
  category: string;
};

const TEMPLATES: Record<string, ActivityTemplate> = {
  easy_run: { sport_type: 'Run', type: 'Run', category: 'easy_run' },
  tempo_run: { sport_type: 'Run', type: 'Run', category: 'tempo_run' },
  long_run: { sport_type: 'Run', type: 'Run', category: 'long_run' },
  trail_run: { sport_type: 'TrailRun', type: 'Run', category: 'trail_run' },
  interval_run: { sport_type: 'Run', type: 'Run', category: 'interval_run' },
  ride: { sport_type: 'Ride', type: 'Ride', category: 'ride' },
  long_ride: { sport_type: 'Ride', type: 'Ride', category: 'long_ride' },
  commute_ride: { sport_type: 'Ride', type: 'Ride', category: 'commute_ride' },
  strength: { sport_type: 'WeightTraining', type: 'WeightTraining', category: 'strength' },
  recovery: { sport_type: 'Walk', type: 'Walk', category: 'recovery' },
};

type WeekdaySlot = {
  dayOfWeek: number;
  hour: number;
  minute: number;
  template: ActivityTemplate;
};

const WEEKLY_SCHEDULE: WeekdaySlot[][] = [
  [
    { dayOfWeek: 1, hour: 6, minute: 30, template: TEMPLATES['easy_run']! },
    { dayOfWeek: 3, hour: 6, minute: 45, template: TEMPLATES['easy_run']! },
    { dayOfWeek: 5, hour: 17, minute: 30, template: TEMPLATES['ride']! },
    { dayOfWeek: 6, hour: 9, minute: 0, template: TEMPLATES['long_run']! },
  ],
  [
    { dayOfWeek: 1, hour: 6, minute: 15, template: TEMPLATES['easy_run']! },
    { dayOfWeek: 2, hour: 17, minute: 0, template: TEMPLATES['tempo_run']! },
    { dayOfWeek: 3, hour: 7, minute: 0, template: TEMPLATES['strength']! },
    { dayOfWeek: 5, hour: 6, minute: 30, template: TEMPLATES['trail_run']! },
    { dayOfWeek: 6, hour: 8, minute: 30, template: TEMPLATES['long_run']! },
  ],
  [
    { dayOfWeek: 1, hour: 6, minute: 0, template: TEMPLATES['easy_run']! },
    { dayOfWeek: 2, hour: 6, minute: 30, template: TEMPLATES['interval_run']! },
    { dayOfWeek: 3, hour: 17, minute: 15, template: TEMPLATES['commute_ride']! },
    { dayOfWeek: 4, hour: 6, minute: 45, template: TEMPLATES['trail_run']! },
    { dayOfWeek: 5, hour: 18, minute: 0, template: TEMPLATES['ride']! },
    { dayOfWeek: 6, hour: 8, minute: 0, template: TEMPLATES['long_run']! },
  ],
  [
    { dayOfWeek: 0, hour: 10, minute: 0, template: TEMPLATES['recovery']! },
    { dayOfWeek: 1, hour: 6, minute: 0, template: TEMPLATES['tempo_run']! },
    { dayOfWeek: 2, hour: 6, minute: 15, template: TEMPLATES['interval_run']! },
    { dayOfWeek: 3, hour: 17, minute: 0, template: TEMPLATES['commute_ride']! },
    { dayOfWeek: 4, hour: 6, minute: 30, template: TEMPLATES['trail_run']! },
    { dayOfWeek: 5, hour: 17, minute: 30, template: TEMPLATES['long_ride']! },
    { dayOfWeek: 6, hour: 8, minute: 0, template: TEMPLATES['long_run']! },
  ],
];

const NAMES: Record<string, string[]> = {
  easy_run: ['Morning Easy Run', 'Easy Shakeout', 'Recovery Run', 'Aerobic Base Run', 'Easy Miles'],
  tempo_run: [
    'Tempo Tuesday',
    'Threshold Run',
    'Tempo Effort',
    'Steady State Run',
    'Comfortably Hard',
  ],
  long_run: ['Long Sunday Run', 'Weekend Long Run', 'Endurance Builder', 'Long Slow Distance'],
  trail_run: [
    'Trail Run - Forest Loop',
    'Hill Trail Session',
    'Off-Road Adventure',
    'Nature Trail Run',
  ],
  interval_run: ['Track Intervals', 'Speed Session', 'Fartlek', '800m Repeats', 'Hill Repeats'],
  ride: ['Evening Spin', 'Saturday Ride', 'Afternoon Cruise', 'Road Ride'],
  long_ride: ['Long Weekend Ride', 'Century Prep Ride', 'Endurance Ride', 'Saturday Morning Ride'],
  commute_ride: ['Morning Commute', 'Commute Home', 'Bike to Work'],
  strength: ['Gym Session', 'Core & Strength', 'Weight Room', 'Strength Circuit'],
  recovery: ['Recovery Walk', 'Active Recovery Walk', 'Easy Stroll', 'Cooldown Walk'],
};

function getDescription(category: string, weekIndex: number): string {
  const phase = weekIndex < 2 ? 'early' : weekIndex < 5 ? 'mid' : 'late';
  const descriptions: Record<string, Record<string, string[]>> = {
    easy_run: {
      early: [
        'Getting back into the groove. Kept it easy and focused on form.',
        'Legs felt heavy but loosened up after the first km.',
      ],
      mid: [
        'Easy pace felt natural today. Building aerobic base nicely.',
        'Smooth run. HR stayed low and breathing was relaxed.',
      ],
      late: [
        'Easy day but legs felt springy. Had to hold back from pushing.',
        'Effortless easy pace. What used to be tempo is now easy.',
      ],
    },
    tempo_run: {
      early: [
        'First real tempo effort in a while. Held on for 15 min at threshold.',
        'Tempo felt tough. Need more consistency.',
      ],
      mid: [
        'Tempo block felt more sustainable. Held 5:20/km for 20 min.',
        'Pace starting to click. Negative split on the tempo portion.',
      ],
      late: [
        'Strong tempo run. Held 5:00/km for 25 min, could go longer.',
        'Threshold feels like the new easy. Massive confidence boost.',
      ],
    },
    long_run: {
      early: [
        'First proper long run. Walked a bit at the end but finished.',
        'Building the long run back up. Easy pace, time on feet.',
      ],
      mid: [
        'Good long run. Fueling strategy worked, no bonking.',
        'Longest run in weeks. Felt controlled and finished strong.',
      ],
      late: [
        'Best long run yet. Negative split, strong finish.',
        'Long run with progressive finish. Last 3km were fastest.',
      ],
    },
    trail_run: {
      early: [
        'Hit the trails. Easy on climbs, enjoyed the downhills.',
        'Muddy trail run. Good for legs, humbling for pace.',
      ],
      mid: [
        'Trail run felt strong. Attacked hills with confidence.',
        'Beautiful trail session. Elevation building leg strength.',
      ],
      late: [
        'Flew over the trails. Climbing power improved dramatically.',
        'Fast trail run. Technical sections felt smooth.',
      ],
    },
    interval_run: {
      early: [
        'First intervals in a while. 4x800m. Legs burning.',
        'Speed work is humbling. Hit targets but recovery was slow.',
      ],
      mid: [
        '6x800m at 3:20. Recovery between reps getting shorter.',
        'Fartlek: 1 min on, 1 min off x10. Felt controlled.',
      ],
      late: [
        '8x800m at 3:10 with 90s rest. Crushed it.',
        'Track ladder: 1200, 1000, 800, 600. All at PR pace.',
      ],
    },
    ride: {
      early: [
        'Easy spin to loosen legs. High cadence, low power.',
        'Casual ride around town. Good cross-training.',
      ],
      mid: [
        'Solid ride with hill efforts. Legs felt good.',
        'Pushed tempo intervals on the bike. Good stimulus.',
      ],
      late: [
        'Fast ride with sustained power. Cycling fitness peaking.',
        'Strong ride. Highest average power on this route.',
      ],
    },
    long_ride: {
      early: ['Long spin at easy pace. Fueled well, no issues.'],
      mid: ['Solid long ride. Mixed in tempo efforts on the flats.'],
      late: ['Epic long ride. Strong the entire time. Legs adapted.'],
    },
    commute_ride: {
      early: ['Bike commute. Easy spin, good start to the day.'],
      mid: ['Commute with more effort today. Every ride counts.'],
      late: ['Fast commute. Pushed the pace, PR on the usual route.'],
    },
    strength: {
      early: ['Core work and compound lifts. Building foundation.'],
      mid: ['Heavier session. Squats, deadlifts, plyometrics.'],
      late: ['Power-focused session. Explosive movements.'],
    },
    recovery: {
      early: ['Easy walk to keep things moving. Legs needed rest.'],
      mid: ['Recovery walk. Mentally refreshing.'],
      late: ['Active recovery. Short walk, foam rolling, stretching.'],
    },
  };
  const pool = descriptions[category]?.[phase] ?? ['Solid session.'];
  return pick(pool);
}

function computeDistanceAndTime(
  category: string,
  progress: number,
): { distance: number; elapsed_time: number } {
  const jitter = 1 + randBetween(-0.08, 0.08);
  switch (category) {
    case 'easy_run': {
      const distKm = (5 + progress * 3) * jitter;
      const paceSecKm = 360 - progress * 45 + randBetween(-10, 10);
      return { distance: distKm * 1000, elapsed_time: Math.round(distKm * paceSecKm) };
    }
    case 'tempo_run': {
      const distKm = (5 + progress * 3) * jitter;
      const paceSecKm = 330 - progress * 40 + randBetween(-8, 8);
      return { distance: distKm * 1000, elapsed_time: Math.round(distKm * paceSecKm) };
    }
    case 'long_run': {
      const distKm = (10 + progress * 6) * jitter;
      const paceSecKm = 370 - progress * 35 + randBetween(-10, 10);
      return { distance: distKm * 1000, elapsed_time: Math.round(distKm * paceSecKm) };
    }
    case 'trail_run': {
      const distKm = (6 + progress * 4) * jitter;
      const paceSecKm = 420 - progress * 40 + randBetween(-15, 15);
      return { distance: distKm * 1000, elapsed_time: Math.round(distKm * paceSecKm) };
    }
    case 'interval_run': {
      const distKm = (4 + progress * 2.5) * jitter;
      const paceSecKm = 310 - progress * 35 + randBetween(-10, 10);
      return { distance: distKm * 1000, elapsed_time: Math.round(distKm * paceSecKm) };
    }
    case 'ride': {
      const distKm = (25 + progress * 15) * jitter;
      const speedKmh = 22 + progress * 6 + randBetween(-2, 2);
      return { distance: distKm * 1000, elapsed_time: Math.round((distKm / speedKmh) * 3600) };
    }
    case 'long_ride': {
      const distKm = (40 + progress * 20) * jitter;
      const speedKmh = 21 + progress * 5 + randBetween(-2, 2);
      return { distance: distKm * 1000, elapsed_time: Math.round((distKm / speedKmh) * 3600) };
    }
    case 'commute_ride': {
      const distKm = 8 + randBetween(-1, 1);
      const speedKmh = 20 + progress * 4 + randBetween(-2, 2);
      return { distance: distKm * 1000, elapsed_time: Math.round((distKm / speedKmh) * 3600) };
    }
    case 'strength': {
      const durationMin = 45 + progress * 15 + randBetween(-5, 5);
      return { distance: 0, elapsed_time: Math.round(durationMin * 60) };
    }
    case 'recovery': {
      const distKm = 3 + randBetween(-0.5, 1);
      const paceSecKm = 600 + randBetween(-30, 30);
      return { distance: distKm * 1000, elapsed_time: Math.round(distKm * paceSecKm) };
    }
    default:
      return { distance: 5000, elapsed_time: 1800 };
  }
}

/**
 * 10 activities spread across the last 7 days.
 * Represents a peak training week with good variety.
 */
const LAST_WEEK_SLOTS: {
  daysAgo: number;
  hour: number;
  minute: number;
  template: ActivityTemplate;
}[] = [
  { daysAgo: 4, hour: 6, minute: 30, template: TEMPLATES['easy_run']! },
  { daysAgo: 3, hour: 7, minute: 0, template: TEMPLATES['strength']! },
  { daysAgo: 2, hour: 17, minute: 30, template: TEMPLATES['ride']! },
  { daysAgo: 1, hour: 8, minute: 0, template: TEMPLATES['long_run']! },
];

function generateActivities(count: number): PlannedActivity[] {
  const now = new Date();
  const activities: PlannedActivity[] = [];
  const slots = LAST_WEEK_SLOTS.slice(0, count);

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i]!;
    const actDate = new Date(now);
    actDate.setDate(actDate.getDate() - slot.daysAgo);
    actDate.setHours(slot.hour, slot.minute, randInt(0, 59), 0);

    // Skip if somehow in the future (e.g. today's slot hour hasn't passed)
    if (actDate > now) continue;

    const cat = slot.template.category;
    // progress 0.8-1.0 to represent a fit athlete in peak week
    const progress = 0.8 + (i / slots.length) * 0.2;
    const { distance, elapsed_time } = computeDistanceAndTime(cat, progress);

    activities.push({
      name: pick(NAMES[cat] ?? ['Workout']),
      sport_type: slot.template.sport_type,
      type: slot.template.type,
      startTime: actDate,
      elapsed_time,
      distance: Math.round(distance),
      description: getDescription(cat, 7), // week 7 = "late" phase descriptions
      trainer: cat === 'strength' ? 1 : 0,
      commute: cat === 'commute_ride' ? 1 : 0,
      category: cat,
      progress,
    });
  }

  activities.sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  return activities;
}

// ---------------------------------------------------------------------------
// Route helpers for FIT generation
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Realistic route waypoints based on actual Munich paths.
// Each route is an array of [lat, lng, elevation] waypoints that the
// interpolator walks along, distributing trackpoints evenly by time.
// Routes are loops (last point ≈ first point).
// ---------------------------------------------------------------------------

type Waypoint = [number, number, number]; // [lat, lng, elevation_m]

// Englischer Garten loop — popular 5-8km running route
const ROUTE_ENGLISCHER_GARTEN: Waypoint[] = [
  [48.1435, 11.587, 519], // Haus der Kunst
  [48.1455, 11.5885, 520], // Along Eisbach
  [48.149, 11.5905, 518], // Monopteros hill base
  [48.152, 11.5915, 521], // Past Chinese Tower
  [48.1555, 11.592, 519], // Approaching Kleinhesseloher See
  [48.158, 11.5935, 517], // North end of lake
  [48.1585, 11.596, 516], // East side of lake
  [48.156, 11.597, 518], // Seehaus area
  [48.153, 11.5955, 520], // Heading south on east path
  [48.15, 11.594, 521], // Mid-park
  [48.147, 11.592, 519], // South of Chinese Tower
  [48.145, 11.59, 520], // Approaching Eisbach
  [48.1435, 11.587, 519], // Back to start
];

// Isar river trail — 6-10km trail run with elevation changes
const ROUTE_ISAR_TRAIL: Waypoint[] = [
  [48.125, 11.593, 510], // Thalkirchen / Tierpark bridge
  [48.128, 11.591, 508], // Along east bank north
  [48.132, 11.589, 515], // Climb up from river
  [48.136, 11.587, 525], // Higher trail section
  [48.139, 11.586, 535], // Ridge viewpoint
  [48.142, 11.585, 528], // Descent toward Maximiliansbrücke
  [48.144, 11.584, 518], // Cross to west bank
  [48.142, 11.582, 522], // West bank heading south
  [48.138, 11.58, 530], // Wooded trail section
  [48.135, 11.581, 540], // Steep climb
  [48.132, 11.583, 535], // Hilltop
  [48.129, 11.585, 520], // Descent back toward river
  [48.126, 11.588, 512], // Rejoining river path
  [48.125, 11.593, 510], // Back to start
];

// Interval session — small Olympic Park loop (~1.5km repeated)
const ROUTE_OLYMPIC_PARK: Waypoint[] = [
  [48.175, 11.55, 515], // Olympic Stadium south
  [48.177, 11.552, 518], // East along park
  [48.179, 11.551, 525], // Olympic hill base
  [48.18, 11.548, 535], // Climbing Olympic hill
  [48.1795, 11.545, 530], // Hill west side
  [48.1775, 11.546, 522], // Descending
  [48.1755, 11.548, 517], // South side loop
  [48.175, 11.55, 515], // Back to start
];

// Cycling route — 25-35km road loop through Munich suburbs
const ROUTE_CYCLING: Waypoint[] = [
  [48.135, 11.58, 520], // Marienplatz area
  [48.14, 11.565, 525], // West toward Theresienwiese
  [48.145, 11.54, 530], // Past Hauptbahnhof
  [48.155, 11.52, 525], // Nymphenburg approach
  [48.16, 11.505, 520], // Nymphenburg Palace
  [48.17, 11.51, 518], // North through Moosach
  [48.18, 11.53, 522], // Northeast
  [48.185, 11.555, 520], // Past Olympic Park
  [48.18, 11.58, 518], // East through Schwabing
  [48.17, 11.595, 515], // Along Englischer Garten east
  [48.16, 11.605, 520], // Bogenhausen
  [48.15, 11.61, 525], // Heading south
  [48.14, 11.605, 522], // Haidhausen
  [48.135, 11.595, 520], // Back toward center
  [48.135, 11.58, 520], // Return to start
];

// Long run — extended route combining Englischer Garten + Isar + city
const ROUTE_LONG_RUN: Waypoint[] = [
  [48.1435, 11.587, 519], // Haus der Kunst
  [48.149, 11.5905, 518], // Through Englischer Garten
  [48.155, 11.592, 519], // North in the park
  [48.16, 11.594, 517], // Far north
  [48.162, 11.598, 515], // Turning east
  [48.16, 11.602, 518], // Along Isar north
  [48.155, 11.6, 516], // South along Isar east bank
  [48.15, 11.598, 514], // Continuing south
  [48.145, 11.596, 516], // Past Maximiliansbrücke
  [48.14, 11.594, 518], // Continuing along river
  [48.135, 11.592, 512], // Deutsches Museum area
  [48.13, 11.59, 510], // South along Isar
  [48.128, 11.587, 515], // Crossing west
  [48.13, 11.584, 520], // West bank heading north
  [48.135, 11.582, 522], // Through Au district
  [48.14, 11.584, 520], // Heading back north
  [48.1435, 11.587, 519], // Return to start
];

// Map category → route template
const ROUTE_FOR_CATEGORY: Record<string, Waypoint[]> = {
  easy_run: ROUTE_ENGLISCHER_GARTEN,
  tempo_run: ROUTE_ENGLISCHER_GARTEN,
  long_run: ROUTE_LONG_RUN,
  trail_run: ROUTE_ISAR_TRAIL,
  interval_run: ROUTE_OLYMPIC_PARK,
  ride: ROUTE_CYCLING,
  long_ride: ROUTE_CYCLING,
  commute_ride: ROUTE_CYCLING,
  recovery: ROUTE_ENGLISCHER_GARTEN,
  strength: [
    [48.1745, 11.5505, 515],
    [48.1746, 11.5507, 515],
    [48.1747, 11.5506, 515],
    [48.1746, 11.5504, 515],
    [48.1745, 11.5505, 515],
  ] as Waypoint[],
};

// ---------------------------------------------------------------------------
// HR / cadence profiles
// ---------------------------------------------------------------------------

interface HrProfile {
  restingHr: number;
  warmupHr: number;
  steadyHr: number;
  peakHr: number;
  cooldownHr: number;
}

function getHrProfile(category: string, progress: number): HrProfile {
  const fb = progress * 8; // fitness bonus
  const profiles: Record<string, HrProfile> = {
    easy_run: {
      restingHr: 72 - fb / 2,
      warmupHr: 120,
      steadyHr: 145 - fb,
      peakHr: 155 - fb,
      cooldownHr: 110,
    },
    tempo_run: {
      restingHr: 72 - fb / 2,
      warmupHr: 125,
      steadyHr: 165 - fb,
      peakHr: 175 - fb,
      cooldownHr: 115,
    },
    long_run: {
      restingHr: 72 - fb / 2,
      warmupHr: 118,
      steadyHr: 150 - fb,
      peakHr: 162 - fb,
      cooldownHr: 112,
    },
    trail_run: {
      restingHr: 72 - fb / 2,
      warmupHr: 120,
      steadyHr: 152 - fb,
      peakHr: 170 - fb,
      cooldownHr: 115,
    },
    interval_run: {
      restingHr: 72 - fb / 2,
      warmupHr: 125,
      steadyHr: 155 - fb,
      peakHr: 182 - fb,
      cooldownHr: 118,
    },
    ride: {
      restingHr: 72 - fb / 2,
      warmupHr: 110,
      steadyHr: 138 - fb,
      peakHr: 155 - fb,
      cooldownHr: 105,
    },
    long_ride: {
      restingHr: 72 - fb / 2,
      warmupHr: 108,
      steadyHr: 135 - fb,
      peakHr: 150 - fb,
      cooldownHr: 102,
    },
    commute_ride: {
      restingHr: 72 - fb / 2,
      warmupHr: 105,
      steadyHr: 125 - fb,
      peakHr: 140 - fb,
      cooldownHr: 100,
    },
    recovery: {
      restingHr: 72 - fb / 2,
      warmupHr: 90,
      steadyHr: 100 - fb / 2,
      peakHr: 115 - fb / 2,
      cooldownHr: 88,
    },
    strength: {
      restingHr: 72 - fb / 2,
      warmupHr: 95,
      steadyHr: 120 - fb / 2,
      peakHr: 155 - fb,
      cooldownHr: 90,
    },
  };
  return (
    profiles[category] ?? {
      restingHr: 72,
      warmupHr: 120,
      steadyHr: 145,
      peakHr: 165,
      cooldownHr: 110,
    }
  );
}

function getCadenceBase(category: string): { base: number; variance: number } {
  const map: Record<string, { base: number; variance: number }> = {
    easy_run: { base: 80, variance: 3 },
    tempo_run: { base: 85, variance: 3 },
    long_run: { base: 82, variance: 3 },
    trail_run: { base: 78, variance: 5 },
    interval_run: { base: 88, variance: 4 },
    ride: { base: 82, variance: 8 },
    long_ride: { base: 80, variance: 8 },
    commute_ride: { base: 78, variance: 10 },
    recovery: { base: 55, variance: 5 },
  };
  return map[category] ?? { base: 80, variance: 5 };
}

// ---------------------------------------------------------------------------
// Route interpolation — walks along waypoints at even time intervals
// ---------------------------------------------------------------------------

function interpolateRoute(
  waypoints: Waypoint[],
  totalPoints: number,
): { lat: number; lng: number; ele: number }[] {
  // Compute cumulative segment distances (degrees-based, good enough for interpolation)
  const segDists: number[] = [0];
  for (let i = 1; i < waypoints.length; i++) {
    const dlat = waypoints[i]![0] - waypoints[i - 1]![0];
    const dlng = waypoints[i]![1] - waypoints[i - 1]![1];
    segDists.push(segDists[i - 1]! + Math.sqrt(dlat * dlat + dlng * dlng));
  }
  const totalDist = segDists[segDists.length - 1]!;

  const result: { lat: number; lng: number; ele: number }[] = [];

  for (let p = 0; p < totalPoints; p++) {
    const targetDist = (p / totalPoints) * totalDist;

    // Find which segment we're on
    let segIdx = 0;
    for (let s = 1; s < segDists.length; s++) {
      if (segDists[s]! >= targetDist) {
        segIdx = s - 1;
        break;
      }
    }

    const segStart = segDists[segIdx]!;
    const segEnd = segDists[segIdx + 1] ?? segDists[segIdx]!;
    const segLen = segEnd - segStart;
    const t = segLen > 0 ? (targetDist - segStart) / segLen : 0;

    const wp0 = waypoints[segIdx]!;
    const wp1 = waypoints[segIdx + 1] ?? wp0;

    result.push({
      lat: wp0[0] + (wp1[0] - wp0[0]) * t + randBetween(-0.00003, 0.00003),
      lng: wp0[1] + (wp1[1] - wp0[1]) * t + randBetween(-0.00003, 0.00003),
      ele: wp0[2] + (wp1[2] - wp0[2]) * t + randBetween(-0.5, 0.5),
    });
  }

  return result;
}

/**
 * For interval runs, repeat the loop multiple times to cover the distance.
 * For long runs/rides, scale the route to match the target distance.
 */
function getRouteWaypoints(category: string, distKm: number): Waypoint[] {
  const base = ROUTE_FOR_CATEGORY[category] ?? ROUTE_ENGLISCHER_GARTEN;

  // Estimate the base route length in km
  let baseDistKm = 0;
  for (let i = 1; i < base.length; i++) {
    const dlat = (base[i]![0] - base[i - 1]![0]) * 111.0;
    const dlng = (base[i]![1] - base[i - 1]![1]) * 74.3;
    baseDistKm += Math.sqrt(dlat * dlat + dlng * dlng);
  }

  if (category === 'interval_run') {
    // Repeat the small loop enough times to cover the distance
    const laps = Math.max(1, Math.round(distKm / baseDistKm));
    const multi: Waypoint[] = [];
    for (let lap = 0; lap < laps; lap++) {
      for (const wp of base) multi.push(wp);
    }
    return multi;
  }

  // For routes that are shorter than needed, scale the coordinates outward
  if (baseDistKm > 0.5 && distKm > baseDistKm * 1.3) {
    const scale = distKm / baseDistKm;
    const centerLat = base.reduce((s, w) => s + w[0], 0) / base.length;
    const centerLng = base.reduce((s, w) => s + w[1], 0) / base.length;
    return base.map((wp) => [
      centerLat + (wp[0] - centerLat) * scale,
      centerLng + (wp[1] - centerLng) * scale,
      wp[2],
    ]);
  }

  return base;
}

// ---------------------------------------------------------------------------
// FIT generation using @garmin/fitsdk (binary, native HR + cadence)
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Encoder, Profile, Utils } = require('@garmin/fitsdk') as typeof import('@garmin/fitsdk');

const SEMICIRCLE_PER_DEG = 2 ** 31 / 180;

function fitSport(activity: PlannedActivity): string {
  if (activity.type === 'Ride') return 'cycling';
  if (activity.type === 'Run') return 'running';
  return 'training';
}

function fitSubSport(activity: PlannedActivity): string {
  if (activity.category === 'strength') return 'strengthTraining';
  if (activity.category === 'trail_run') return 'trail';
  if (activity.category === 'interval_run') return 'generic';
  return 'generic';
}

function generateFit(activity: PlannedActivity): Buffer {
  const totalSec = activity.elapsed_time;
  const pointInterval = 5;
  const totalPoints = Math.floor(totalSec / pointInterval);
  if (totalPoints < 4) {
    return generateMinimalFit(activity);
  }

  const distKm = activity.distance / 1000;
  const waypoints = getRouteWaypoints(activity.category, distKm);
  const route = interpolateRoute(waypoints, totalPoints);

  const hrProfile = getHrProfile(activity.category, activity.progress);
  const cadenceProfile = getCadenceBase(activity.category);
  const includeCadence = activity.category !== 'strength';

  const startTime = Utils.convertDateToDateTime(activity.startTime);
  const localOffset = activity.startTime.getTimezoneOffset() * -60;

  const encoder = new Encoder();

  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    timeCreated: startTime,
    serialNumber: 12345,
  });

  encoder.onMesg(Profile.MesgNum.DEVICE_INFO, {
    deviceIndex: 'creator',
    manufacturer: 'development',
    product: 0,
    productName: 'mAIcoach',
    serialNumber: 12345,
    softwareVersion: 1.0,
    timestamp: startTime,
  });

  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: startTime,
    event: 'timer',
    eventType: 'start',
  });

  let currentHr = hrProfile.restingHr;
  let hrSum = 0;
  let hrMax = 0;
  let cumDist = 0;
  let timestamp = startTime;

  for (let i = 0; i < totalPoints; i++) {
    const pct = i / totalPoints;
    const pt = route[i]!;

    if (pct < 0.06) {
      currentHr = hrProfile.restingHr + (hrProfile.warmupHr - hrProfile.restingHr) * (pct / 0.06);
    } else if (pct < 0.14) {
      currentHr =
        hrProfile.warmupHr + (hrProfile.steadyHr - hrProfile.warmupHr) * ((pct - 0.06) / 0.08);
    } else if (pct < 0.86) {
      const drift = (pct - 0.14) / 0.72;
      currentHr = hrProfile.steadyHr + drift * (hrProfile.peakHr - hrProfile.steadyHr) * 0.6;
      if (activity.category === 'interval_run') {
        currentHr += Math.sin(pct * Math.PI * 12) * 15;
      }
      if (activity.category === 'strength') {
        currentHr += Math.sin(pct * Math.PI * 16) * 20;
      }
      if (activity.category === 'trail_run') {
        if (i > 0 && pt.ele > route[i - 1]!.ele + 0.3) {
          currentHr += 8;
        }
      }
    } else {
      currentHr =
        hrProfile.peakHr - (hrProfile.peakHr - hrProfile.cooldownHr) * ((pct - 0.86) / 0.14);
    }
    currentHr = Math.max(60, Math.min(254, Math.round(currentHr + randBetween(-2, 2))));
    hrSum += currentHr;
    if (currentHr > hrMax) hrMax = currentHr;

    if (i > 0) {
      const dlat = (pt.lat - route[i - 1]!.lat) * 111000;
      const dlng = (pt.lng - route[i - 1]!.lng) * 74300;
      cumDist += Math.sqrt(dlat * dlat + dlng * dlng);
    }

    let cad = Math.round(
      cadenceProfile.base + randBetween(-cadenceProfile.variance, cadenceProfile.variance),
    );
    if (i > 0 && pt.ele > route[i - 1]!.ele + 0.3 && activity.type === 'Run') {
      cad = Math.max(40, cad - 4);
    }

    const speed = i > 0 ? cumDist / (i * pointInterval) : 0;

    const record: Record<string, unknown> = {
      timestamp,
      positionLat: Math.round(pt.lat * SEMICIRCLE_PER_DEG),
      positionLong: Math.round(pt.lng * SEMICIRCLE_PER_DEG),
      enhancedAltitude: pt.ele,
      distance: cumDist,
      enhancedSpeed: speed,
      heartRate: currentHr,
    };
    if (includeCadence) {
      record['cadence'] = cad;
    }

    encoder.onMesg(Profile.MesgNum.RECORD, record);
    timestamp = startTime + (i + 1) * pointInterval;
  }

  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp,
    event: 'timer',
    eventType: 'stop',
  });

  const avgHr = Math.round(hrSum / totalPoints);

  encoder.onMesg(Profile.MesgNum.LAP, {
    messageIndex: 0,
    timestamp,
    startTime,
    totalElapsedTime: totalSec,
    totalTimerTime: totalSec,
    totalDistance: activity.distance,
    avgHeartRate: avgHr,
    maxHeartRate: hrMax,
  });

  encoder.onMesg(Profile.MesgNum.SESSION, {
    messageIndex: 0,
    timestamp,
    startTime,
    totalElapsedTime: totalSec,
    totalTimerTime: totalSec,
    totalDistance: activity.distance,
    sport: fitSport(activity),
    subSport: fitSubSport(activity),
    firstLapIndex: 0,
    numLaps: 1,
    avgHeartRate: avgHr,
    maxHeartRate: hrMax,
  });

  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp,
    numSessions: 1,
    localTimestamp: timestamp + localOffset,
    totalTimerTime: totalSec,
  });

  return Buffer.from(encoder.close());
}

function generateMinimalFit(activity: PlannedActivity): Buffer {
  const startTime = Utils.convertDateToDateTime(activity.startTime);
  const localOffset = activity.startTime.getTimezoneOffset() * -60;
  const totalSec = activity.elapsed_time;

  const encoder = new Encoder();

  encoder.onMesg(Profile.MesgNum.FILE_ID, {
    type: 'activity',
    manufacturer: 'development',
    product: 0,
    timeCreated: startTime,
    serialNumber: 12345,
  });

  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: startTime,
    event: 'timer',
    eventType: 'start',
  });

  const endTime = startTime + totalSec;

  encoder.onMesg(Profile.MesgNum.RECORD, {
    timestamp: startTime,
    positionLat: Math.round(48.135 * SEMICIRCLE_PER_DEG),
    positionLong: Math.round(11.58 * SEMICIRCLE_PER_DEG),
    distance: 0,
  });

  encoder.onMesg(Profile.MesgNum.RECORD, {
    timestamp: endTime,
    positionLat: Math.round(48.136 * SEMICIRCLE_PER_DEG),
    positionLong: Math.round(11.581 * SEMICIRCLE_PER_DEG),
    distance: 0,
  });

  encoder.onMesg(Profile.MesgNum.EVENT, {
    timestamp: endTime,
    event: 'timer',
    eventType: 'stop',
  });

  encoder.onMesg(Profile.MesgNum.LAP, {
    messageIndex: 0,
    timestamp: endTime,
    startTime,
    totalElapsedTime: totalSec,
    totalTimerTime: totalSec,
  });

  encoder.onMesg(Profile.MesgNum.SESSION, {
    messageIndex: 0,
    timestamp: endTime,
    startTime,
    totalElapsedTime: totalSec,
    totalTimerTime: totalSec,
    sport: fitSport(activity),
    subSport: 'generic',
    firstLapIndex: 0,
    numLaps: 1,
  });

  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: endTime,
    numSessions: 1,
    localTimestamp: endTime + localOffset,
    totalTimerTime: totalSec,
  });

  return Buffer.from(encoder.close());
}

// ---------------------------------------------------------------------------
// Strava Upload API
// ---------------------------------------------------------------------------

interface UploadResult {
  activityId: number | null;
  error: string | null;
}

async function uploadFitActivity(
  accessToken: string,
  activity: PlannedActivity,
  fitData: Buffer,
  index: number,
): Promise<UploadResult> {
  const boundary = `----mAIcoachSeed${Date.now()}${index}`;
  const actType =
    activity.type === 'Ride'
      ? 'ride'
      : activity.type === 'Walk'
        ? 'walk'
        : activity.type === 'WeightTraining'
          ? 'workout'
          : 'run';

  const fields: [string, string][] = [
    ['data_type', 'fit'],
    ['activity_type', actType],
    ['name', activity.name],
    ['description', activity.description],
    ['external_id', `maicoach-fit-${index}-${Date.now()}`],
  ];
  if (activity.trainer) fields.push(['trainer', '1']);
  if (activity.commute) fields.push(['commute', '1']);

  const textParts = fields.map(
    ([name, value]) =>
      `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}`,
  );
  const preamble = Buffer.from(
    textParts.join('\r\n') +
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="seed-${index}.fit"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, fitData, epilogue]);

  const res = await rateLimitedFetch('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    return { activityId: null, error: `Upload failed (${res.status}): ${errBody}` };
  }

  const upload = (await res.json()) as { id: number; status: string; error: string | null };

  // Poll for processing completion
  for (let attempt = 0; attempt < 12; attempt++) {
    await sleep(4000);
    const checkRes = await rateLimitedFetch(`https://www.strava.com/api/v3/uploads/${upload.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!checkRes.ok) continue;
    const status = (await checkRes.json()) as {
      status: string;
      activity_id: number | null;
      error: string | null;
    };
    if (status.error) {
      return { activityId: null, error: `Processing error: ${status.error}` };
    }
    if (status.activity_id) {
      return { activityId: status.activity_id, error: null };
    }
  }

  return { activityId: null, error: 'Upload timed out waiting for processing' };
}

async function updateActivitySportType(
  accessToken: string,
  activityId: number,
  sportType: string,
): Promise<void> {
  await rateLimitedFetch(`https://www.strava.com/api/v3/activities/${activityId}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ sport_type: sportType }),
  });
}

// ---------------------------------------------------------------------------
// Create Activity API (for non-GPS activities like strength training)
// ---------------------------------------------------------------------------

async function createManualActivity(
  accessToken: string,
  activity: PlannedActivity,
): Promise<{ id: number }> {
  const body = new URLSearchParams();
  body.set('name', activity.name);
  body.set('sport_type', activity.sport_type);
  body.set('type', activity.type);
  body.set('start_date_local', activity.startTime.toISOString());
  body.set('elapsed_time', String(activity.elapsed_time));
  body.set('description', activity.description);
  if (activity.distance > 0) body.set('distance', String(activity.distance));
  if (activity.trainer) body.set('trainer', '1');
  if (activity.commute) body.set('commute', '1');

  const res = await rateLimitedFetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Create failed (${res.status}): ${errBody}`);
  }

  return (await res.json()) as { id: number };
}

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

function formatPace(distanceM: number, elapsedSec: number, isRide: boolean): string {
  if (distanceM === 0) return `${Math.round(elapsedSec / 60)} min`;
  if (isRide) {
    return `${(distanceM / 1000 / (elapsedSec / 3600)).toFixed(1)} km/h`;
  }
  const secPerKm = elapsedSec / (distanceM / 1000);
  return `${Math.floor(secPerKm / 60)}:${String(Math.round(secPerKm % 60)).padStart(2, '0')} /km`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function parseArgs(): { dryRun: boolean; count: number } {
  const args = process.argv.slice(2);
  let dryRun = false;
  let count = 4;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') dryRun = true;
    if (args[i] === '--count' && args[i + 1]) {
      count = parseInt(args[i + 1]!, 10);
      i++;
    }
  }

  return { dryRun, count };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🌱 Strava Activity Seeder (FIT Upload)\n');

  const { dryRun, count } = parseArgs();

  const env = loadEnv();
  const clientId = env['STRAVA_CLIENT_ID'];
  const clientSecret = env['STRAVA_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local');
  }

  const activities = generateActivities(count);

  console.log(`📋 Generated ${activities.length} activities over the last ~2 months\n`);

  const sportCounts: Record<string, number> = {};
  let totalDistKm = 0;

  console.log('  #  Date        Time   Type             Distance   Pace         Name');
  console.log('  -  ----------  -----  ---------------  ---------  -----------  ----');

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i]!;
    const d = a.startTime;
    const dateStr = d.toISOString().slice(0, 10);
    const timeStr = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    const distKm = a.distance / 1000;
    const isRide = a.type === 'Ride';
    const pace = formatPace(a.distance, a.elapsed_time, isRide);
    const flags = [a.trainer ? '🏋️' : '', a.commute ? '🚲' : ''].filter(Boolean).join(' ');
    const method = '(FIT+HR)';

    console.log(
      `  ${String(i + 1).padStart(2)}  ${dateStr}  ${timeStr}  ${a.sport_type.padEnd(15)}  ${distKm > 0 ? `${distKm.toFixed(1).padStart(5)} km` : '   --   '}  ${pace.padEnd(11)}  ${a.name} ${method}${flags ? ` ${flags}` : ''}`,
    );

    sportCounts[a.sport_type] = (sportCounts[a.sport_type] ?? 0) + 1;
    totalDistKm += distKm;
  }

  console.log('\n📊 Summary:');
  console.log(`   Total activities: ${activities.length} (all FIT uploads with HR)`);
  console.log(`   Total distance:   ${totalDistKm.toFixed(0)} km`);
  console.log(
    `   Sport mix:        ${Object.entries(sportCounts)
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ')}`,
  );
  console.log(`   API requests:     ~${activities.length * 3} (upload+poll+update per activity)`);

  if (dryRun) {
    console.log('\n🏁 Dry run complete. No activities were created on Strava.');
    return;
  }

  console.log('\n⚠️  This will upload FIT files with GPS + HR + cadence data.');
  console.log('   Rate limit: pauses automatically when approaching 100 req/15min.');
  console.log(`   Estimated time: ~${Math.ceil((activities.length * 12) / 60)} minutes\n`);

  const accessToken = await getAccessToken(clientId, clientSecret);

  console.log('\n🚀 Uploading activities...\n');

  const created: { id: number; name: string }[] = [];
  const failed: { name: string; error: string }[] = [];

  for (let i = 0; i < activities.length; i++) {
    const a = activities[i]!;
    const tag = `[${String(i + 1).padStart(2)}/${activities.length}]`;

    try {
      const fit = generateFit(a);
      const result = await uploadFitActivity(accessToken, a, fit, i);

      if (result.error) {
        failed.push({ name: a.name, error: result.error });
        console.log(`  ❌ ${tag} ${a.name}: ${result.error}`);
      } else if (result.activityId) {
        if (a.sport_type !== 'Run' && a.sport_type !== 'Ride' && a.sport_type !== 'Walk') {
          await updateActivitySportType(accessToken, result.activityId, a.sport_type);
        }
        created.push({ id: result.activityId, name: a.name });
        console.log(`  ✅ ${tag} ${a.name} (${a.sport_type}) → ID ${result.activityId}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      failed.push({ name: a.name, error: msg });
      console.log(`  ❌ ${tag} ${a.name}: ${msg}`);
    }

    // Small delay between activities
    if (i < activities.length - 1) await sleep(2000);
  }

  console.log('\n' + '='.repeat(60));
  console.log('🏁 Seeding complete!');
  console.log(`   Created: ${created.length}/${activities.length}`);
  if (failed.length > 0) {
    console.log(`   Failed:  ${failed.length}`);
    for (const f of failed) console.log(`     - ${f.name}: ${f.error}`);
  }
  console.log(`\n   View on Strava: https://www.strava.com/athlete/training`);
}

main().catch((err: unknown) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
