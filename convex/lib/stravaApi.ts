const STRAVA_API_BASE = 'https://www.strava.com/api/v3';
const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';

// ---------------------------------------------------------------------------
// Strava API response types
// ---------------------------------------------------------------------------

export interface StravaActivitySummary {
  id: number;
  name: string;
  sport_type: string;
  start_date: string;
  start_date_local: string;
  timezone: string;
  distance: number;
  moving_time: number;
  elapsed_time: number;
  total_elevation_gain: number;
  has_heartrate: boolean;
  average_heartrate?: number;
  max_heartrate?: number;
  average_speed: number;
  max_speed: number;
  average_cadence?: number;
  average_watts?: number;
  average_temp?: number;
  calories?: number;
  suffer_score?: number;
  gear_id?: string | null;
  splits_metric?: StravaSplit[];
  laps?: StravaLap[];
}

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone: number;
}

export interface StravaLap {
  id: number;
  name: string;
  elapsed_time: number;
  moving_time: number;
  start_date: string;
  distance: number;
  average_speed: number;
  max_speed: number;
  average_heartrate?: number;
  max_heartrate?: number;
  average_cadence?: number;
  average_watts?: number;
  lap_index: number;
  split: number;
  pace_zone?: number;
}

export interface StravaStreamSet {
  time?: StravaStream<number>;
  latlng?: StravaStream<[number, number]>;
  distance?: StravaStream<number>;
  altitude?: StravaStream<number>;
  velocity_smooth?: StravaStream<number>;
  heartrate?: StravaStream<number>;
  cadence?: StravaStream<number>;
  watts?: StravaStream<number>;
  temp?: StravaStream<number>;
  grade_smooth?: StravaStream<number>;
}

export interface StravaStream<T> {
  data: T[];
  series_type: string;
  original_size: number;
  resolution: string;
}

export interface StravaZonesResponse {
  heart_rate?: {
    custom_zones: boolean;
    zones: { min: number; max: number }[];
  };
}

export interface StravaGearResponse {
  id: string;
  name: string;
  distance: number;
  brand_name?: string;
  model_name?: string;
  resource_state: number;
  retired?: boolean;
}

export interface StravaTokenRefreshResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
}

// ---------------------------------------------------------------------------
// Error classes
// ---------------------------------------------------------------------------

export class StravaApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    message: string,
  ) {
    super(message);
    this.name = 'StravaApiError';
  }
}

export class StravaRateLimitError extends StravaApiError {
  retryAfterSec: number;

  constructor(path: string, retryAfter: number) {
    super(429, path, `Strava rate limit hit on ${path}, retry after ${String(retryAfter)}s`);
    this.name = 'StravaRateLimitError';
    this.retryAfterSec = retryAfter;
  }
}

// ---------------------------------------------------------------------------
// Core fetch helper
// ---------------------------------------------------------------------------

export async function stravaGet<T>(accessToken: string, path: string): Promise<T> {
  const url = `${STRAVA_API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const limitHeader = res.headers.get('X-RateLimit-Limit');
  const usageHeader = res.headers.get('X-RateLimit-Usage');
  if (limitHeader ?? usageHeader) {
    console.log(
      `Strava rate limit: usage=${usageHeader ?? '?'} limit=${limitHeader ?? '?'} status=${String(res.status)}`,
    );
  }

  if (res.status === 429) {
    const retryAfter = parseInt(res.headers.get('Retry-After') ?? '60', 10);
    throw new StravaRateLimitError(path, retryAfter);
  }

  if (!res.ok) {
    const text = await res.text();
    throw new StravaApiError(res.status, path, `Strava ${String(res.status)} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Endpoint wrappers
// ---------------------------------------------------------------------------

export async function fetchActivitiesList(
  token: string,
  opts: { after?: number; page?: number; perPage?: number } = {},
): Promise<StravaActivitySummary[]> {
  const params = new URLSearchParams();
  if (opts.after !== undefined) params.set('after', String(opts.after));
  params.set('page', String(opts.page ?? 1));
  params.set('per_page', String(opts.perPage ?? 200));
  return stravaGet<StravaActivitySummary[]>(token, `/athlete/activities?${params.toString()}`);
}

export async function fetchActivityDetail(
  token: string,
  activityId: string,
): Promise<StravaActivitySummary> {
  return stravaGet<StravaActivitySummary>(token, `/activities/${activityId}`);
}

const STREAM_KEYS =
  'time,latlng,distance,altitude,velocity_smooth,heartrate,cadence,watts,temp,grade_smooth';

export async function fetchActivityStreams(
  token: string,
  activityId: string,
): Promise<StravaStreamSet> {
  const raw = await stravaGet<StravaStream<unknown>[]>(
    token,
    `/activities/${activityId}/streams?keys=${STREAM_KEYS}&key_type=type`,
  );

  const result: StravaStreamSet = {};
  for (const stream of raw) {
    const key = stream.series_type as keyof StravaStreamSet;
    (result as Record<string, unknown>)[key] = stream;
  }
  return result;
}

export async function fetchActivityLaps(token: string, activityId: string): Promise<StravaLap[]> {
  return stravaGet<StravaLap[]>(token, `/activities/${activityId}/laps`);
}

export async function fetchAthleteZones(token: string): Promise<StravaZonesResponse> {
  return stravaGet<StravaZonesResponse>(token, '/athlete/zones');
}

export async function fetchGearDetail(token: string, gearId: string): Promise<StravaGearResponse> {
  return stravaGet<StravaGearResponse>(token, `/gear/${gearId}`);
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------

export async function refreshStravaToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string,
): Promise<StravaTokenRefreshResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed (${String(res.status)}): ${text}`);
  }

  return res.json() as Promise<StravaTokenRefreshResponse>;
}

// ---------------------------------------------------------------------------
// Activity bucket derivation
// ---------------------------------------------------------------------------

const RUN_TYPES = new Set(['Run', 'TrailRun', 'VirtualRun', 'Walk']);

const RIDE_TYPES = new Set(['Ride', 'EBikeRide', 'VirtualRide', 'MountainBikeRide', 'GravelRide']);

export function deriveActivityBucket(sportType: string): 'run' | 'ride' | 'other' {
  if (RUN_TYPES.has(sportType)) return 'run';
  if (RIDE_TYPES.has(sportType)) return 'ride';
  return 'other';
}
