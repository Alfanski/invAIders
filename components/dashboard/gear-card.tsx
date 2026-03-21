'use client';

import type { ReactNode } from 'react';

interface GearCardProps {
  name: string;
  gearType: 'shoe' | 'bike' | 'other';
  distanceKm: number;
  brandName?: string | null | undefined;
  modelName?: string | null | undefined;
}

const LIFESPAN_KM: Record<string, number> = {
  shoe: 800,
  bike: 15000,
  other: 5000,
};

export function GearCard({
  name,
  gearType,
  distanceKm,
  brandName,
  modelName,
}: Readonly<GearCardProps>): ReactNode {
  const lifespanKm = LIFESPAN_KM[gearType] ?? 5000;
  const pct = Math.min((distanceKm / lifespanKm) * 100, 100);
  const barColor = pct >= 90 ? '#f87171' : pct >= 70 ? '#fbbf24' : '#34d399';

  const subtitle = [brandName, modelName].filter(Boolean).join(' ');

  return (
    <section className="glass-panel p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-glass">
          {gearType === 'shoe' ? (
            <svg
              className="h-4 w-4 text-glass-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M3 17h18M3 17l2-9h4l1 3h4l1-3h4l2 9"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 text-glass-text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h4 className="truncate text-sm font-semibold text-white">{name}</h4>
            <span className="shrink-0 text-xs tabular-nums text-glass-text-muted">
              {distanceKm.toFixed(0)} km
            </span>
          </div>
          {subtitle && (
            <p className="mt-0.5 truncate text-[10px] text-glass-text-dim">{subtitle}</p>
          )}
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-glass">
            <div
              className="h-full rounded-full transition-all duration-700 ease-out"
              style={{ width: `${String(pct)}%`, backgroundColor: barColor }}
            />
          </div>
          <p className="mt-1 text-[9px] text-glass-text-dim">
            {pct >= 90
              ? 'Consider replacing soon'
              : `${String(Math.round(lifespanKm - distanceKm))} km remaining (est.)`}
          </p>
        </div>
      </div>
    </section>
  );
}
