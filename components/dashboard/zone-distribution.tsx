'use client';

import { useMemo } from 'react';
import type { ReactNode } from 'react';

import type { HeartRateZone } from '@/types/dashboard';

interface ZoneDistributionProps {
  heartRateStream: readonly number[];
  zones: readonly HeartRateZone[];
  totalTimeSec: number;
}

const ZONE_NAMES = ['Z1', 'Z2', 'Z3', 'Z4', 'Z5'];
const ZONE_LABELS = ['Recovery', 'Endurance', 'Tempo', 'Threshold', 'VO2max'];
const ZONE_COLORS = ['#94a3b8', '#60a5fa', '#34d399', '#fbbf24', '#f87171'];

function formatZoneTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${String(h)}:${String(rm).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m)}:${String(s).padStart(2, '0')}`;
}

export function ZoneDistribution({
  heartRateStream,
  zones,
  totalTimeSec,
}: Readonly<ZoneDistributionProps>): ReactNode {
  const zoneData = useMemo(() => {
    if (heartRateStream.length === 0 || zones.length === 0) return [];

    const counts = new Array<number>(zones.length).fill(0);

    for (const hr of heartRateStream) {
      for (let i = 0; i < zones.length; i++) {
        const zone = zones[i];
        if (!zone) continue;
        const max = zone.max === -1 ? Infinity : zone.max;
        if (hr >= zone.min && hr < max) {
          counts[i] = (counts[i] ?? 0) + 1;
          break;
        }
      }
    }

    const total = counts.reduce((a, b) => a + b, 0);
    if (total === 0) return [];

    return counts.map((count, i) => ({
      zone: ZONE_NAMES[i] ?? `Z${String(i + 1)}`,
      label: ZONE_LABELS[i] ?? '',
      color: ZONE_COLORS[i] ?? '#94a3b8',
      pct: (count / total) * 100,
      timeSec: (count / total) * totalTimeSec,
    }));
  }, [heartRateStream, zones, totalTimeSec]);

  if (zoneData.length === 0) return null;

  return (
    <section className="glass-panel p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
        Heart Rate Zones
      </h3>

      <div className="flex h-6 overflow-hidden rounded-full">
        {zoneData.map((z) =>
          z.pct > 0 ? (
            <div
              key={z.zone}
              className="flex items-center justify-center text-[9px] font-bold text-white/90 transition-all"
              style={{
                width: `${String(z.pct)}%`,
                backgroundColor: z.color,
                minWidth: z.pct > 2 ? undefined : '2px',
              }}
            >
              {z.pct >= 8 ? z.zone : ''}
            </div>
          ) : null,
        )}
      </div>

      <div className="mt-3 space-y-1.5">
        {zoneData.map((z) => (
          <div key={z.zone} className="flex items-center gap-3 text-xs">
            <div
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: z.color }}
            />
            <span className="w-6 font-semibold" style={{ color: z.color }}>
              {z.zone}
            </span>
            <span className="w-16 text-glass-text-muted">{z.label}</span>
            <span className="ml-auto tabular-nums text-glass-text-muted">
              {formatZoneTime(z.timeSec)}
            </span>
            <span className="w-10 text-right tabular-nums font-medium text-white">
              {z.pct.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
