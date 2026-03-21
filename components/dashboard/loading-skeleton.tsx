'use client';

import type { ReactNode } from 'react';

export function LoadingSkeleton(): ReactNode {
  return (
    <main className="space-y-5">
      <div className="glass-panel-elevated animate-pulse p-5">
        <div className="h-6 w-48 rounded bg-white/10" />
        <div className="mt-2 h-4 w-32 rounded bg-white/5" />
      </div>
      <div className="glass-panel animate-pulse p-5">
        <div className="h-4 w-full rounded bg-white/5" />
        <div className="mt-2 h-4 w-3/4 rounded bg-white/5" />
      </div>
      <div className="grid animate-pulse grid-cols-3 gap-3">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="glass-panel p-4">
            <div className="h-3 w-16 rounded bg-white/5" />
            <div className="mt-2 h-5 w-20 rounded bg-white/10" />
          </div>
        ))}
      </div>
    </main>
  );
}
