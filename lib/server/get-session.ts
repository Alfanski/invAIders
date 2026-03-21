import { cookies } from 'next/headers';

import { SESSION_COOKIE_NAME } from '@/lib/strava/constants';
import { verifySessionToken } from '@/lib/session';

export interface SessionData {
  athleteId: string;
  stravaAthleteId: string;
}

export async function getSession(): Promise<SessionData | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
