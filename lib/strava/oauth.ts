import { STRAVA_AUTH_URL, STRAVA_SCOPES, STRAVA_TOKEN_URL } from './constants';

function getClientId(): string {
  const id = process.env['STRAVA_CLIENT_ID'];
  if (!id) throw new Error('STRAVA_CLIENT_ID is not set');
  return id;
}

function getClientSecret(): string {
  const secret = process.env['STRAVA_CLIENT_SECRET'];
  if (!secret) throw new Error('STRAVA_CLIENT_SECRET is not set');
  return secret;
}

function getRedirectUri(): string {
  return process.env['STRAVA_REDIRECT_URI'] ?? 'http://localhost:3000/api/auth/strava/callback';
}

export function buildAuthorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: 'code',
    approval_prompt: 'auto',
    scope: STRAVA_SCOPES,
    state,
  });
  return `${STRAVA_AUTH_URL}?${params.toString()}`;
}

export interface StravaTokenResponse {
  token_type: string;
  expires_at: number;
  expires_in: number;
  refresh_token: string;
  access_token: string;
  athlete: StravaAthlete;
}

export interface StravaAthlete {
  id: number;
  firstname: string;
  lastname: string;
  profile_medium: string;
  profile: string;
  sex: 'M' | 'F' | null;
  weight: number | null;
  measurement_preference: 'feet' | 'meters';
}

export async function exchangeCode(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      code,
      grant_type: 'authorization_code',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token exchange failed (${String(res.status)}): ${text}`);
  }

  return res.json() as Promise<StravaTokenResponse>;
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: getClientId(),
      client_secret: getClientSecret(),
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Strava token refresh failed (${String(res.status)}): ${text}`);
  }

  return res.json() as Promise<StravaTokenResponse>;
}
