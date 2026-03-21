'use client';

import type { ReactNode } from 'react';

import type { RecoveryState } from '@/types/form';

interface RecoveryIndicatorProps {
  recovery: RecoveryState;
}

export function RecoveryIndicator({ recovery }: Readonly<RecoveryIndicatorProps>): ReactNode {
  const pct = Math.min(100, recovery.recoveryPct);
  const barColor =
    pct >= 90 ? '#22c55e' : pct >= 60 ? '#eab308' : pct >= 30 ? '#f97316' : '#ef4444';

  return (
    <section className="glass-panel p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-glass-text-dim">
        Recovery Status
      </h3>

      <div className="flex items-center gap-4">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-white">{String(pct)}%</span>
          <span className="text-[10px] uppercase tracking-widest text-glass-text-dim">
            Recovered
          </span>
        </div>

        <div className="flex-1">
          <div className="mb-2 h-2 overflow-hidden rounded-full bg-glass">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${String(pct)}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="text-xs text-glass-text-muted">
            {String(Math.round(recovery.hoursSinceLastActivity))}h since last activity
            <span className="mx-1 text-glass-text-dim">|</span>
            Last effort: {String(Math.round(recovery.lastActivityTrimp))} TRIMP
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-coach-tsb">
            Ready for
          </p>
          {recovery.readyFor.length > 0 ? (
            <ul className="space-y-0.5">
              {recovery.readyFor.map((item) => (
                <li key={item} className="text-xs text-glass-text-muted">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-glass-text-muted">Not yet ready</p>
          )}
        </div>
        <div>
          <p className="mb-1.5 text-[10px] font-medium uppercase tracking-widest text-coach-atl">
            Not ready for
          </p>
          {recovery.notReadyFor.length > 0 ? (
            <ul className="space-y-0.5">
              {recovery.notReadyFor.map((item) => (
                <li key={item} className="text-xs text-glass-text-muted">
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-glass-text-muted">All clear</p>
          )}
        </div>
      </div>
    </section>
  );
}
