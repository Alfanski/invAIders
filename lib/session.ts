import crypto from 'node:crypto';

import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SEC } from '@/lib/strava/constants';

interface SessionPayload {
  athleteId: string;
  stravaAthleteId: string;
  exp: number;
}

function getSecret(): string {
  const secret = process.env['SESSION_SECRET'];
  if (!secret) throw new Error('SESSION_SECRET is not set');
  return secret;
}

function sign(data: string): string {
  return crypto.createHmac('sha256', getSecret()).update(data).digest('hex');
}

export function createSessionToken(athleteId: string, stravaAthleteId: string): string {
  const payload: SessionPayload = {
    athleteId,
    stravaAthleteId,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC,
  };
  const json = JSON.stringify(payload);
  const encoded = Buffer.from(json).toString('base64url');
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(
  token: string,
): { athleteId: string; stravaAthleteId: string } | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [encoded, signature] = parts as [string, string];
  const expected = sign(encoded);

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  try {
    const json = Buffer.from(encoded, 'base64url').toString('utf-8');
    const payload = JSON.parse(json) as SessionPayload;

    if (payload.exp < Math.floor(Date.now() / 1000)) return null;

    return { athleteId: payload.athleteId, stravaAthleteId: payload.stravaAthleteId };
  } catch {
    return null;
  }
}

export function sessionCookieOptions(): {
  name: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
} {
  return {
    name: SESSION_COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  };
}
