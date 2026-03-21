import crypto from 'node:crypto';

import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { STRAVA_OAUTH_STATE_COOKIE } from '@/lib/strava/constants';
import { buildAuthorizeUrl } from '@/lib/strava/oauth';

export async function GET(): Promise<NextResponse> {
  const state = crypto.randomBytes(32).toString('hex');

  const cookieStore = await cookies();
  cookieStore.set(STRAVA_OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600, // 10 minutes
  });

  const url = buildAuthorizeUrl(state);
  return NextResponse.redirect(url);
}
