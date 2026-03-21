'use client';

import type { ReactNode } from 'react';

import type { FormZone } from '@/lib/domain/coaching-engine';
import { getAllZoneBoundaries } from '@/lib/form/zones';
import type { ZonePresentation } from '@/types/form';

const ZONE_STYLES: Record<FormZone, ZonePresentation> = {
  overreaching: {
    zone: 'overreaching',
    label: 'Overreaching -- injury risk',
    shortLabel: 'Overreaching',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.2)',
  },
  fatigued: {
    zone: 'fatigued',
    label: 'Fatigued -- absorbing load',
    shortLabel: 'Fatigued',
    color: '#f97316',
    bgColor: 'rgba(249, 115, 22, 0.2)',
  },
  balanced: {
    zone: 'balanced',
    label: 'Balanced -- normal training',
    shortLabel: 'Balanced',
    color: '#eab308',
    bgColor: 'rgba(234, 179, 8, 0.2)',
  },
  race_ready: {
    zone: 'race_ready',
    label: 'Race Ready -- peak form',
    shortLabel: 'Race Ready',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.2)',
  },
  fresh: {
    zone: 'fresh',
    label: 'Fresh -- possibly undertrained',
    shortLabel: 'Fresh',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.2)',
  },
};

const ZONE_BAR_LABELS: Record<FormZone, string> = {
  overreaching: 'Over',
  fatigued: 'Fatigued',
  balanced: 'Balanced',
  race_ready: 'Ready',
  fresh: 'Fresh',
};

interface FormGaugeProps {
  tsb: number;
  ctl: number;
  atl: number;
  zone: FormZone;
  trend7d: { ctl: number; atl: number; tsb: number };
}

const TSB_MIN = -40;
const TSB_MAX = 25;
const TSB_RANGE = TSB_MAX - TSB_MIN;

function tsbToT(tsb: number): number {
  return (Math.min(TSB_MAX, Math.max(TSB_MIN, tsb)) - TSB_MIN) / TSB_RANGE;
}

function TrendDelta({ value, suffix }: Readonly<{ value: number; suffix?: string }>): ReactNode {
  const isUp = value >= 0;
  return (
    <span className={`text-[10px] font-medium ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
      {isUp ? '+' : ''}
      {value.toFixed(1)}
      {suffix ? <span className="ml-0.5 text-[9px] text-glass-text-dim">{suffix}</span> : null}
    </span>
  );
}

export function FormGauge({ tsb, ctl, atl, zone, trend7d }: Readonly<FormGaugeProps>): ReactNode {
  const presentation = ZONE_STYLES[zone];
  const allBoundaries = getAllZoneBoundaries();
  const positionPct = tsbToT(tsb) * 100;

  return (
    <section
      className="glass-panel-elevated p-5"
      aria-label={`Training form: ${presentation.shortLabel}, TSB ${tsb.toFixed(1)}`}
    >
      {/* TSB value + zone */}
      <div className="text-center">
        <div className="flex items-baseline justify-center gap-2">
          <span className="text-3xl font-bold text-white">{tsb.toFixed(1)}</span>
          <span className="text-[10px] font-medium uppercase tracking-widest text-glass-text-dim">
            TSB
          </span>
          <TrendDelta value={trend7d.tsb} suffix="7d" />
        </div>
        <p className="mt-1 text-sm font-semibold" style={{ color: presentation.color }}>
          {presentation.shortLabel}
        </p>
        <p className="mt-0.5 text-[11px] text-glass-text-muted">{presentation.label}</p>
      </div>

      {/* Zone bar */}
      <div className="mt-5">
        <div className="relative">
          {/* Track background */}
          <div className="absolute inset-0 rounded-full bg-white/[0.03]" style={{ height: 14 }} />

          {/* Zone segments */}
          <div className="relative flex h-3.5 overflow-hidden rounded-full">
            {allBoundaries.map((b) => {
              const widthPct = ((b.max - b.min) / TSB_RANGE) * 100;
              const style = ZONE_STYLES[b.zone];
              const isActive = b.zone === zone;
              return (
                <div
                  key={b.zone}
                  className="h-full transition-opacity duration-300"
                  style={{
                    width: `${String(widthPct)}%`,
                    backgroundColor: style.color,
                    opacity: isActive ? 0.85 : 0.15,
                  }}
                />
              );
            })}
          </div>

          {/* Position marker */}
          <div
            className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${String(positionPct)}%` }}
          >
            <div
              className="h-6 w-6 rounded-full border-[2.5px] border-white shadow-lg"
              style={{
                backgroundColor: presentation.color,
                boxShadow: `0 0 12px ${presentation.color}60, 0 2px 8px rgba(0,0,0,0.4)`,
              }}
            />
          </div>
        </div>

        {/* Zone labels */}
        <div className="mt-2.5 flex">
          {allBoundaries.map((b) => {
            const widthPct = ((b.max - b.min) / TSB_RANGE) * 100;
            return (
              <span
                key={b.zone}
                className={`text-center text-[9px] uppercase tracking-wider ${
                  b.zone === zone ? 'font-semibold text-white/70' : 'text-white/25'
                }`}
                style={{ width: `${String(widthPct)}%` }}
              >
                {ZONE_BAR_LABELS[b.zone]}
              </span>
            );
          })}
        </div>
      </div>

      {/* CTL + ATL stats */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <div className="rounded-xl bg-glass/50 px-3 py-2.5 text-center ring-1 ring-glass-border/50">
          <p className="text-[9px] font-medium uppercase tracking-widest text-glass-text-dim">
            Fitness
            <span className="ml-1 text-glass-text-dim/50">(CTL)</span>
          </p>
          <p className="mt-0.5 text-xl font-bold text-coach-ctl">{ctl.toFixed(1)}</p>
          <TrendDelta value={trend7d.ctl} suffix="7d" />
        </div>
        <div className="rounded-xl bg-glass/50 px-3 py-2.5 text-center ring-1 ring-glass-border/50">
          <p className="text-[9px] font-medium uppercase tracking-widest text-glass-text-dim">
            Fatigue
            <span className="ml-1 text-glass-text-dim/50">(ATL)</span>
          </p>
          <p className="mt-0.5 text-xl font-bold text-coach-atl">{atl.toFixed(1)}</p>
          <TrendDelta value={trend7d.atl} suffix="7d" />
        </div>
      </div>
    </section>
  );
}
