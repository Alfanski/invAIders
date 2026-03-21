import Link from 'next/link';
import type { ReactNode } from 'react';

export default function HomePage(): ReactNode {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center gap-6 px-6">
      <div className="glass-panel-elevated px-10 py-12 text-center">
        <h1 className="text-4xl font-bold tracking-tight">
          m<span className="text-accent">AI</span>coach
        </h1>
        <p className="mt-3 text-sm text-glass-text-muted">
          Your AI-powered fitness coach. Connects to Strava, analyzes your workouts, and delivers
          personalized coaching insights.
        </p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:brightness-110 glow-accent"
        >
          Open Dashboard
        </Link>
      </div>
    </main>
  );
}
