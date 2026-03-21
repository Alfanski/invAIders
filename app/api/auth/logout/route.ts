import { type NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/strava/constants';

export function GET(request: NextRequest): NextResponse {
  const response = NextResponse.redirect(new URL('/', request.url));
  response.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
