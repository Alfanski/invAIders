'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { ActivityBucket } from '@/lib/sport-config';
import { getSportConfig } from '@/lib/sport-config';
import type { StravaSplit } from '@/types/dashboard';

interface SplitTableProps {
  splits: readonly StravaSplit[];
  activityBucket?: ActivityBucket | undefined;
}

const ZONE_COLORS: Record<number, string> = {
  1: '#94a3b8',
  2: '#60a5fa',
  3: '#34d399',
  4: '#fbbf24',
  5: '#f87171',
};

function speedToPaceSecPerKm(speed: number): number {
  if (speed <= 0) return 0;
  return 1000 / speed;
}

export function SplitTable({
  splits,
  activityBucket = 'run',
}: Readonly<SplitTableProps>): ReactNode {
  const sportCfg = useMemo(() => getSportConfig(activityBucket), [activityBucket]);

  if (splits.length === 0) return null;

  const paces = splits.map((s) => speedToPaceSecPerKm(s.average_speed));
  const avgPace = paces.reduce((a, b) => a + b, 0) / paces.length;

  function paceColor(pace: number): string {
    const diff = (pace - avgPace) / avgPace;
    if (sportCfg.invertSpeedAxis) {
      if (diff < -0.02) return '#34d399';
      if (diff > 0.02) return '#f87171';
    } else {
      if (diff > 0.02) return '#34d399';
      if (diff < -0.02) return '#f87171';
    }
    return 'rgba(255,255,255,0.9)';
  }

  return (
    <section className="glass-panel p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
        Splits
      </h3>

      <div className="overflow-x-auto scrollbar-hide">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-glass-border text-[10px] font-medium uppercase tracking-wider text-glass-text-dim">
              <th className="py-2 pr-3 text-left">{sportCfg.splitLabel}</th>
              <th className="py-2 pr-3 text-right">
                {activityBucket === 'ride' ? 'Speed' : 'Pace'}
              </th>
              <th className="py-2 pr-3 text-right">HR</th>
              {sportCfg.showElevation && <th className="py-2 pr-3 text-right">Elev</th>}
              <th className="py-2 text-center">Zone</th>
            </tr>
          </thead>
          <tbody>
            {splits.map((split, idx) => {
              const pace = paces[idx] ?? 0;
              return (
                <tr key={split.split} className="border-b border-glass-border/50 last:border-0">
                  <td className="py-2 pr-3 text-left tabular-nums text-glass-text-muted">
                    {split.split}
                  </td>
                  <td
                    className="py-2 pr-3 text-right tabular-nums font-medium"
                    style={{ color: paceColor(pace) }}
                  >
                    {sportCfg.formatSpeed(pace)}
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-glass-text-muted">
                    {split.average_heartrate
                      ? String(Math.round(split.average_heartrate))
                      : '\u2014'}
                  </td>
                  {sportCfg.showElevation && (
                    <td className="py-2 pr-3 text-right tabular-nums text-glass-text-muted">
                      {split.elevation_difference > 0 ? '+' : ''}
                      {Math.round(split.elevation_difference)} m
                    </td>
                  )}
                  <td className="py-2 text-center">
                    {split.pace_zone ? (
                      <span
                        className="inline-block rounded-md px-2 py-0.5 text-[10px] font-semibold"
                        style={{
                          color: ZONE_COLORS[split.pace_zone] ?? '#94a3b8',
                          backgroundColor: `${ZONE_COLORS[split.pace_zone] ?? '#94a3b8'}20`,
                        }}
                      >
                        Z{split.pace_zone}
                      </span>
                    ) : (
                      '\u2014'
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {splits.length >= 2 && <SplitTrend paces={paces} />}
    </section>
  );
}

function SplitTrend({ paces }: { paces: number[] }): ReactNode {
  const mid = Math.floor(paces.length / 2);
  const firstHalf = paces.slice(0, mid);
  const secondHalf = paces.slice(mid);

  const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const isNegativeSplit = avgSecond < avgFirst;
  const diffPct = Math.abs(((avgSecond - avgFirst) / avgFirst) * 100);

  if (diffPct < 1) return null;

  return (
    <div className="mt-3 flex items-center gap-2 text-xs">
      <span
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium"
        style={{
          color: isNegativeSplit ? '#34d399' : '#fbbf24',
          backgroundColor: isNegativeSplit ? 'rgba(52,211,153,0.1)' : 'rgba(251,191,36,0.1)',
        }}
      >
        {isNegativeSplit ? (
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
          </svg>
        ) : (
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
            />
          </svg>
        )}
        {isNegativeSplit ? 'Negative split' : 'Positive split'} ({diffPct.toFixed(1)}%)
      </span>
    </div>
  );
}
