/**
 * Creates a test activity on Strava. Handles the full OAuth flow:
 *   1. If no cached tokens → opens browser for authorization, captures callback
 *   2. If tokens expired → refreshes automatically
 *   3. Creates a manual activity via POST /api/v3/activities
 *
 * Usage:  npx tsx scripts/strava-test-activity.ts
 *         npx tsx scripts/strava-test-activity.ts --name "Evening Run" --type Ride
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
// OAuth authorization flow (opens browser, captures callback)
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
      res.end('<h1>✅ Authorized!</h1><p>You can close this tab and return to the terminal.</p>');
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
  authUrl.searchParams.set('scope', 'activity:write,activity:read_all');
  authUrl.searchParams.set('approval_prompt', 'auto');

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

  const data = (await res.json()) as StravaTokens & { athlete?: { id: number; firstname: string } };
  if (data.athlete) {
    console.log(`👤 Authenticated as: ${data.athlete.firstname} (ID: ${data.athlete.id})`);
  }

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at,
  };
}

// ---------------------------------------------------------------------------
// Get a valid access token (authorize → cache → refresh as needed)
// ---------------------------------------------------------------------------

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
// Create test activity
// ---------------------------------------------------------------------------

interface CreateActivityParams {
  name: string;
  type: string;
  sport_type: string;
  start_date_local: string;
  elapsed_time: number;
  distance: number;
  description: string;
}

function parseArgs(): Partial<CreateActivityParams> {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (let i = 0; i < args.length; i += 2) {
    const key = args[i]?.replace(/^--/, '');
    const val = args[i + 1];
    if (key && val) parsed[key] = val;
  }
  return parsed as Partial<CreateActivityParams>;
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createActivity(
  accessToken: string,
  overrides: Partial<CreateActivityParams>,
): Promise<void> {
  const distanceM = randomBetween(3000, 15000);
  const elapsedSec = Math.round(distanceM / (randomBetween(8, 14) / 3.6));
  const now = new Date();
  now.setMinutes(now.getMinutes() - Math.round(elapsedSec / 60) - 10);

  const params: CreateActivityParams = {
    name: `Test Run ${now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
    type: 'Run',
    sport_type: 'Run',
    start_date_local: now.toISOString(),
    elapsed_time: elapsedSec,
    distance: distanceM,
    description: 'Auto-generated test activity from strava-test-activity script',
    ...overrides,
  };

  console.log('\n🏃 Creating test activity...');
  console.log(`   Name:     ${params.name}`);
  console.log(`   Type:     ${params.sport_type}`);
  console.log(`   Distance: ${(params.distance / 1000).toFixed(1)} km`);
  console.log(
    `   Duration: ${Math.floor(params.elapsed_time / 60)}:${String(params.elapsed_time % 60).padStart(2, '0')}`,
  );
  console.log(`   Start:    ${params.start_date_local}`);

  const body = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    body.set(k, String(v));
  }

  const res = await fetch('https://www.strava.com/api/v3/activities', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Failed to create activity (${res.status}): ${errBody}`);
  }

  const activity = (await res.json()) as { id: number; name: string; distance: number };
  console.log(`\n✅ Activity created!`);
  console.log(`   Strava ID:  ${activity.id}`);
  console.log(`   View:       https://www.strava.com/activities/${activity.id}`);
  console.log(`\n⏳ The Strava webhook should fire within a few seconds...`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🚀 Strava Test Activity Creator\n');

  const env = loadEnv();
  const clientId = env['STRAVA_CLIENT_ID'];
  const clientSecret = env['STRAVA_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local');
  }

  const accessToken = await getAccessToken(clientId, clientSecret);
  const overrides = parseArgs();
  await createActivity(accessToken, overrides);
}

main().catch((err: unknown) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
