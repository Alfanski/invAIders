import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { CoachOrb } from '@/components/coach/coach-orb';
import { CoachPanel } from '@/components/coach/coach-panel';
import { CoachProvider } from '@/components/coach/coach-provider';
import { DashboardShell } from '@/components/layout/dashboard-shell';
import { DashboardTabBar } from '@/components/layout/dashboard-tab-bar';
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { SessionProvider } from '@/components/providers/session-provider';
import { getSession } from '@/lib/server/get-session';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactNode> {
  const session = await getSession();

  if (!session) {
    redirect('/');
  }

  return (
    <CoachProvider>
      <DashboardShell>
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            m<span className="text-accent">AI</span>coach
          </h1>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/dashboard/profile"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-glass text-glass-text-muted transition-colors hover:bg-glass-hover hover:text-glass-text"
              aria-label="Profile"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"
                />
              </svg>
            </Link>
            {/* Plain <a> tag -- Next.js <Link> would prefetch /api/auth/logout,
                which clears the session cookie and logs the user out. */}
            <a
              href="/api/auth/logout"
              className="rounded-lg border border-glass-border px-3 py-1.5 text-xs font-medium text-glass-text-muted transition hover:bg-glass-hover hover:text-glass-text"
            >
              Sign out
            </a>
          </div>
        </header>
        <DashboardTabBar />
        <SessionProvider athleteId={session.athleteId} stravaAthleteId={session.stravaAthleteId}>
          {children}
        </SessionProvider>
      </DashboardShell>
      <CoachOrb />
      <CoachPanel />
    </CoachProvider>
  );
}
