'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

export function ConnectPrompt(): ReactNode {
  return (
    <main className="flex flex-col items-center justify-center gap-6 py-16">
      <div className="glass-panel-elevated px-10 py-12 text-center">
        <h2 className="text-xl font-semibold text-white">Connect Strava</h2>
        <p className="mt-3 max-w-sm text-sm text-glass-text-muted">
          Link your Strava account to see your real workouts, training load, and AI coaching
          insights.
        </p>
        <Link
          href="/api/auth/strava"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:brightness-110 glow-accent"
        >
          Connect with Strava
        </Link>
      </div>
    </main>
  );
}
