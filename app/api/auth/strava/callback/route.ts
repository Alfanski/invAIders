import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME, STRAVA_OAUTH_STATE_COOKIE } from '@/lib/strava/constants';
import { createSessionToken, sessionCookieOptions } from '@/lib/session';
import { exchangeCode } from '@/lib/strava/oauth';

function getConvexSiteUrl(): string {
  const siteUrl = process.env['CONVEX_SITE_URL'];
  if (siteUrl) return siteUrl;
  const deployUrl = process.env['CONVEX_URL'] ?? process.env['NEXT_PUBLIC_CONVEX_URL'];
  if (!deployUrl) throw new Error('CONVEX_SITE_URL or CONVEX_URL must be set');
  return deployUrl.replace('.cloud', '.site');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = request.nextUrl;
  const baseUrl = request.nextUrl.origin;

  const error = searchParams.get('error');
  if (error === 'access_denied') {
    return NextResponse.redirect(new URL('/?error=strava_denied', baseUrl));
  }

  const code = searchParams.get('code');
  const state = searchParams.get('state');
  if (!code || !state) {
    return NextResponse.redirect(new URL('/?error=missing_params', baseUrl));
  }

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STRAVA_OAUTH_STATE_COOKIE)?.value;
  cookieStore.delete(STRAVA_OAUTH_STATE_COOKIE);

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(new URL('/?error=invalid_state', baseUrl));
  }

  try {
    const tokenResponse = await exchangeCode(code);
    const { athlete } = tokenResponse;
    console.log(
      '[strava-callback] exchangeCode ok, athleteId:',
      athlete.id,
      'token starts with:',
      tokenResponse.access_token.slice(0, 8),
    );

    const siteUrl = getConvexSiteUrl();
    const secret = process.env['CONVEX_WEBHOOK_SECRET'];
    console.log('[strava-callback] calling completeOAuth via HTTP...');
    const oauthResponse = await fetch(`${siteUrl}/api/internal/complete-oauth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        stravaAthleteId: String(athlete.id),
        measurementPreference: athlete.measurement_preference,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        expiresAt: tokenResponse.expires_at,
        scope: 'read,read_all,profile:read_all,activity:read_all',
        ...(athlete.firstname ? { firstName: athlete.firstname } : {}),
        ...(athlete.lastname ? { lastName: athlete.lastname } : {}),
        ...(athlete.profile_medium ? { profileMediumUrl: athlete.profile_medium } : {}),
        ...(athlete.profile ? { profileUrl: athlete.profile } : {}),
        ...(athlete.sex != null ? { sex: athlete.sex } : {}),
        ...(athlete.weight != null ? { weightKg: athlete.weight } : {}),
        ...(athlete.email ? { email: athlete.email } : {}),
      }),
    });
    if (!oauthResponse.ok) {
      const errBody = await oauthResponse.text();
      throw new Error(`completeOAuth failed (${String(oauthResponse.status)}): ${errBody}`);
    }
    const result = (await oauthResponse.json()) as { athleteId: string };
    console.log('[strava-callback] completeOAuth returned athleteId:', result.athleteId);

    const sessionToken = createSessionToken(result.athleteId, String(athlete.id));
    const opts = sessionCookieOptions();
    const response = NextResponse.redirect(new URL('/dashboard', baseUrl));
    response.cookies.set(SESSION_COOKIE_NAME, sessionToken, opts);

    return response;
  } catch (err) {
    console.error('Strava OAuth callback error:', err);
    return NextResponse.redirect(new URL('/?error=oauth_failed', baseUrl));
  }
}
