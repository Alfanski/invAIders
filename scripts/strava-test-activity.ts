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
// FIT generation with HR, cadence, elevation using @garmin/fitsdk
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { Encoder, Profile, Utils } = require('@garmin/fitsdk') as typeof import('@garmin/fitsdk');

const SEMICIRCLE_PER_DEG = 2 ** 31 / 180;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function generateFit(): { fitData: Buffer; distanceKm: number; durationMin: number } {
  const startLat = 48.135;
  const startLng = 11.58;
  const startDate = new Date();
  startDate.setMinutes(startDate.getMinutes() - 35);

  const segmentKm = 1.25;
  const totalKm = segmentKm * 4;
  const paceSecPerKm = randomBetween(310, 350);
  const totalSec = Math.round(totalKm * paceSecPerKm);
  const pointInterval = 5;
  const totalPoints = Math.floor(totalSec / pointInterval);
  const pointsPerSeg = Math.floor(totalPoints / 4);

  const latPerPoint = segmentKm / 111.0 / pointsPerSeg;
  const lngPerPoint = segmentKm / 74.3 / pointsPerSeg;

  let lat = startLat;
  let lng = startLng;
  let elev = 520 + randomBetween(-5, 5);
  let hr = 115;
  let cad = 78;
  let hrSum = 0;
  let hrMax = 0;
  let cumDist = 0;
  let prevLat = lat;
  let prevLng = lng;

  const startTime = Utils.convertDateToDateTime(startDate);
  const localOffset = startDate.getTimezoneOffset() * -60;

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

  let pointIndex = 0;

  function addPoint(i: number): void {
    const progress = i / totalPoints;

    if (progress < 0.1) hr = 115 + progress * 350;
    else if (progress < 0.85) hr = 148 + randomBetween(-5, 5) + progress * 15;
    else hr = 160 - (progress - 0.85) * 200 + randomBetween(-3, 3);
    hr = Math.max(110, Math.min(254, Math.round(hr)));
    hrSum += hr;
    if (hr > hrMax) hrMax = hr;

    cad = Math.round(82 + randomBetween(-3, 3) + (progress < 0.85 ? progress * 8 : -5));
    elev += randomBetween(-0.5, 0.5);

    const dlat = (lat - prevLat) * 111000;
    const dlng = (lng - prevLng) * 74300;
    cumDist += Math.sqrt(dlat * dlat + dlng * dlng);
    prevLat = lat;
    prevLng = lng;

    const speed = pointIndex > 0 ? cumDist / (pointIndex * pointInterval) : 0;

    encoder.onMesg(Profile.MesgNum.RECORD, {
      timestamp: startTime + i * pointInterval,
      positionLat: Math.round(lat * SEMICIRCLE_PER_DEG),
      positionLong: Math.round(lng * SEMICIRCLE_PER_DEG),
      enhancedAltitude: elev,
      distance: cumDist,
      enhancedSpeed: speed,
      heartRate: hr,
      cadence: cad,
    });

    pointIndex++;
  }

  for (let i = 0; i < pointsPerSeg; i++) {
    addPoint(i);
    lng += lngPerPoint;
  }
  for (let i = 0; i < pointsPerSeg; i++) {
    addPoint(pointsPerSeg + i);
    lat += latPerPoint;
    elev += 0.15;
  }
  for (let i = 0; i < pointsPerSeg; i++) {
    addPoint(pointsPerSeg * 2 + i);
    lng -= lngPerPoint;
  }
  for (let i = 0; i < pointsPerSeg; i++) {
    addPoint(pointsPerSeg * 3 + i);
    lat -= latPerPoint;
    elev -= 0.15;
  }

  const endTime = startTime + totalSec;
  const avgHr = Math.round(hrSum / (pointsPerSeg * 4));

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
    totalDistance: totalKm * 1000,
    avgHeartRate: avgHr,
    maxHeartRate: hrMax,
  });

  encoder.onMesg(Profile.MesgNum.SESSION, {
    messageIndex: 0,
    timestamp: endTime,
    startTime,
    totalElapsedTime: totalSec,
    totalTimerTime: totalSec,
    totalDistance: totalKm * 1000,
    sport: 'running',
    subSport: 'generic',
    firstLapIndex: 0,
    numLaps: 1,
    avgHeartRate: avgHr,
    maxHeartRate: hrMax,
  });

  encoder.onMesg(Profile.MesgNum.ACTIVITY, {
    timestamp: endTime,
    numSessions: 1,
    localTimestamp: endTime + localOffset,
    totalTimerTime: totalSec,
  });

  const fitData = Buffer.from(encoder.close());
  return { fitData, distanceKm: totalKm, durationMin: Math.round(totalSec / 60) };
}

// ---------------------------------------------------------------------------
// Upload FIT to Strava
// ---------------------------------------------------------------------------

async function uploadActivity(accessToken: string): Promise<void> {
  const { fitData, distanceKm, durationMin } = generateFit();

  console.log('\n🏃 Uploading test activity with GPS + HR + cadence...');
  console.log(`   Distance: ${distanceKm.toFixed(1)} km`);
  console.log(`   Duration: ~${durationMin} min`);

  const boundary = '----mAIcoachBoundary' + Date.now();

  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="data_type"\r\n\r\nfit\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="activity_type"\r\n\r\nrun\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="description"\r\n\r\nAuto-generated test with HR/cadence/GPS from mAIcoach script\r\n` +
      `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="test-run.fit"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  );
  const epilogue = Buffer.from(`\r\n--${boundary}--`);
  const body = Buffer.concat([preamble, fitData, epilogue]);

  const res = await fetch('https://www.strava.com/api/v3/uploads', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': `multipart/form-data; boundary=${boundary}`,
    },
    body,
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Upload failed (${res.status}): ${errBody}`);
  }

  const upload = (await res.json()) as { id: number; status: string; activity_id: number | null };
  console.log(`\n📤 Upload accepted (ID: ${upload.id})`);
  console.log(`   Status: ${upload.status}`);

  console.log('\n⏳ Waiting for Strava to process the file...');
  let activityId: number | null = null;
  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise((r) => setTimeout(r, 3000));
    const checkRes = await fetch(`https://www.strava.com/api/v3/uploads/${upload.id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!checkRes.ok) continue;
    const status = (await checkRes.json()) as {
      status: string;
      activity_id: number | null;
      error: string | null;
    };
    if (status.error) {
      throw new Error(`Strava processing error: ${status.error}`);
    }
    if (status.activity_id) {
      activityId = status.activity_id;
      break;
    }
    process.stdout.write('.');
  }

  if (!activityId) {
    console.log('\n⚠️  Upload still processing. Check Strava manually.');
    return;
  }

  console.log(`\n\n✅ Activity created!`);
  console.log(`   Strava ID:  ${activityId}`);
  console.log(`   View:       https://www.strava.com/activities/${activityId}`);
  console.log(`\n⏳ The Strava webhook should fire within a few seconds...`);
  console.log(`   Watch the n8n pipeline at: https://lorenzo-hackathon.app.n8n.cloud`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('🚀 Strava Test Activity Upload (FIT with HR + cadence)\n');

  const env = loadEnv();
  const clientId = env['STRAVA_CLIENT_ID'];
  const clientSecret = env['STRAVA_CLIENT_SECRET'];

  if (!clientId || !clientSecret) {
    throw new Error('STRAVA_CLIENT_ID and STRAVA_CLIENT_SECRET must be set in .env.local');
  }

  const accessToken = await getAccessToken(clientId, clientSecret);
  await uploadActivity(accessToken);
}

main().catch((err: unknown) => {
  console.error('\n❌ Error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
