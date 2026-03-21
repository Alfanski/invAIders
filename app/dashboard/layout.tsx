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
