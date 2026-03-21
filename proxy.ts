import { type NextRequest, NextResponse } from 'next/server';

import { SESSION_COOKIE_NAME } from '@/lib/strava/constants';

export function proxy(request: NextRequest): NextResponse {
  const session = request.cookies.get(SESSION_COOKIE_NAME);
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (pathname === '/' && session) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/', '/dashboard/:path*'],
};
