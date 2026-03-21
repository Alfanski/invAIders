/**
 * Manual one-shot Strava sync: fetches fresh OAuth tokens then calls
 * completeOAuth on the Convex deployment, which upserts the athlete +
 * tokens and schedules the backfill job (if not already complete).
 *
 * Usage:  npx tsx scripts/strava-sync-to-convex.ts
 *
 * If no cached tokens exist, opens a browser for Strava authorization.
 * Strava API cost: 0 extra calls (backfill runs server-side on Convex).
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const TOKEN_FILE = resolve(ROOT, '.strava-tokens.json');
const ENV_FILE = resolve(ROOT, '.env.local');
const CALLBACK_PORT = 8888;
const REDIRECT_URI = `http://localhost:${CALLBACK_PORT}/callback`;

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
    const key = trimmed.slice(0, eq);
    let val = trimmed.slice(eq + 1);
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
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
  athlete?: {
    id: number;
    firstname?: string;
    lastname?: string;
    profile_medium?: string;
    profile?: string;
    sex?: string;
    weight?: number;
    measurement_preference?: string;
  };
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
  console.log('Tokens saved to .strava-tokens.json');
}

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokens> {
  console.log('Refreshing access token...');
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

  return (await res.json()) as StravaTokens;
}

// ---------------------------------------------------------------------------
// OAuth authorization flow
// ---------------------------------------------------------------------------

function openBrowser(url: string): void {
  try {
    execSync(`open "${url}"`, { stdio: 'ignore' });
  } catch {
    console.log(`\nOpen this URL in your browser:\n${url}\n`);
  }
}

function waitForAuthCode(): Promise<string> {
  return new Promise((resolveCode, reject) => {
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
      res.end('<h1>Authorized!</h1><p>You can close this tab and return to the terminal.</p>');
      server.close();
      resolveCode(code);
    });

    server.listen(CALLBACK_PORT, () => {
      console.log(`Waiting for OAuth callback on http://localhost:${CALLBACK_PORT}/callback ...`);
    });

    server.on('error', reject);
  });
}

async function authorize(clientId: string, clientSecret: string): Promise<StravaTokens> {
  const authUrl = new URL('https://www.strava.com/oauth/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', 'activity:read_all,profile:read_all');
  authUrl.searchParams.set('approval_prompt', 'auto');

  console.log('\nOpening Strava authorization page...');
  openBrowser(authUrl.toString());

  const code = await waitForAuthCode();
  console.log('Authorization code received, exchanging for tokens...');

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

  return (await res.json()) as StravaTokens;
}

async function getValidTokens(clientId: string, clientSecret: string): Promise<StravaTokens> {
  let tokens = loadTokens();

  if (!tokens) {
    console.log('No cached tokens found -- starting OAuth flow...');
    tokens = await authorize(clientId, clientSecret);
    saveTokens(tokens);
    return tokens;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  if (tokens.expires_at <= nowSec + 60) {
    const refreshed = await refreshAccessToken(clientId, clientSecret, tokens.refresh_token);
    // Preserve the athlete info from the original auth if refresh doesn't include it
    if (!refreshed.athlete && tokens.athlete) {
      refreshed.athlete = tokens.athlete;
    }
    saveTokens(refreshed);
    return refreshed;
  }

  const minLeft = Math.round((tokens.expires_at - nowSec) / 60);
  console.log(`Using cached token (expires in ${minLeft} min)`);
  return tokens;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('=== Strava -> Convex Manual Sync ===\n');

  const env = loadEnv();
  const clientId = env['STRAVA_CLIENT_ID'];
  const clientSecret = env['STRAVA_CLIENT_SECRET'];
  const convexUrl = env['NEXT_PUBLIC_CONVEX_URL'] ?? env['CONVEX_URL'];

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local');
  }
  if (!convexUrl) {
    throw new Error('NEXT_PUBLIC_CONVEX_URL or CONVEX_URL must be set in .env.local');
  }

  console.log(`Convex URL: ${convexUrl}`);

  // Step 1: Get valid Strava tokens
  const tokens = await getValidTokens(clientId, clientSecret);

  // If we don't have athlete info from the token response, fetch it
  let athlete = tokens.athlete;
  if (!athlete) {
    console.log('Fetching athlete profile from Strava...');
    const profileRes = await fetch('https://www.strava.com/api/v3/athlete', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    if (!profileRes.ok) {
      throw new Error(`Failed to fetch athlete profile (${profileRes.status})`);
    }
    athlete = (await profileRes.json()) as NonNullable<StravaTokens['athlete']>;
    tokens.athlete = athlete;
    saveTokens(tokens);
  }

  if (!athlete?.id) {
    throw new Error('Could not determine Strava athlete ID');
  }

  console.log(
    `\nAthlete: ${athlete.firstname ?? ''} ${athlete.lastname ?? ''} (ID: ${athlete.id})`,
  );

  // Step 2: Call completeOAuth on Convex (schedules backfill if not already done)
  const convex = new ConvexHttpClient(convexUrl);

  console.log('\nCalling Convex completeOAuth to upsert athlete + tokens + trigger backfill...');
  const result = await convex.action(api.strava.completeOAuth, {
    stravaAthleteId: String(athlete.id),
    ...(athlete.firstname ? { firstName: athlete.firstname } : {}),
    ...(athlete.lastname ? { lastName: athlete.lastname } : {}),
    ...(athlete.profile_medium ? { profileMediumUrl: athlete.profile_medium } : {}),
    ...(athlete.profile ? { profileUrl: athlete.profile } : {}),
    ...(athlete.sex === 'M' || athlete.sex === 'F' ? { sex: athlete.sex } : {}),
    ...(athlete.weight ? { weightKg: athlete.weight } : {}),
    ...(athlete.measurement_preference === 'feet' || athlete.measurement_preference === 'meters'
      ? { measurementPreference: athlete.measurement_preference }
      : {}),
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at,
    scope: 'activity:read_all,profile:read_all',
  });

  console.log(`\nDone! Convex athlete ID: ${result.athleteId}`);
  console.log('Backfill will run server-side on Convex (fetches up to 1000 activities).');
  console.log('Check the Convex dashboard logs for progress.');

  // Query activity count to verify
  const activities = await convex.query(api.activities.listRecentForAthlete, {
    athleteId: result.athleteId as never,
    limit: 200,
  });
  console.log(`\nActivities currently in DB: ${activities.length}`);
  if (activities.length > 0 && activities[0]) {
    console.log(`Most recent: "${activities[0].name}" (${activities[0].startDate.slice(0, 10)})`);
  }
}

main().catch((err: unknown) => {
  console.error('\nError:', err instanceof Error ? err.message : err);
  process.exit(1);
});
