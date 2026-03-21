import Link from 'next/link';
import type { ReactNode } from 'react';

import { CoachOrb } from '@/components/coach/coach-orb';
import { CoachPanel } from '@/components/coach/coach-panel';
import { CoachProvider } from '@/components/coach/coach-provider';
import { DashboardTabBar } from '@/components/layout/dashboard-tab-bar';
import { SessionProvider } from '@/components/providers/session-provider';
import { getSession } from '@/lib/server/get-session';

export default async function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>): Promise<ReactNode> {
  const session = await getSession();

  return (
    <CoachProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <header className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">
            m<span className="text-accent">AI</span>coach
          </h1>
          <Link
            href="/api/auth/logout"
            className="rounded-lg border border-glass-border px-3 py-1.5 text-xs font-medium text-glass-text-muted transition hover:bg-glass-hover hover:text-glass-text"
          >
            Sign out
          </Link>
        </header>
        <DashboardTabBar />
        {session ? (
          <SessionProvider athleteId={session.athleteId} stravaAthleteId={session.stravaAthleteId}>
            {children}
          </SessionProvider>
        ) : (
          children
        )}
      </div>
      <CoachOrb />
      <CoachPanel />
    </CoachProvider>
  );
}
