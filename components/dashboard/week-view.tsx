'use client';

import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis } from 'recharts';

import { formatDuration } from '@/lib/units';
import type { HeartRateZone, WeekData, WeekTotals } from '@/types/dashboard';

import { DayDetail } from './day-detail';
import { WeekDayBar } from './week-day-bar';
import { ZoneDistribution } from './zone-distribution';

interface WeekViewProps {
  week: WeekData;
  heartRateStream?: readonly number[] | undefined;
  heartRateZones?: readonly HeartRateZone[] | undefined;
}

export function WeekView({
  week,
  heartRateStream,
  heartRateZones,
}: Readonly<WeekViewProps>): ReactNode {
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const handleSelect = useCallback((index: number) => {
    setSelectedDay((prev) => (prev === index ? null : index));
  }, []);

  const barData = week.days.map((d, i) => ({
    name: d.dayShort,
    minutes: d.durationSec != null ? Math.round(d.durationSec / 60) : 0,
    index: i,
    fill:
      selectedDay === i
        ? '#6366f1'
        : d.hasActivity
          ? 'rgba(99, 102, 241, 0.35)'
          : 'var(--chart-bar-empty)',
  }));

  return (
    <main className="space-y-5">
      {/* Header */}
      <section className="glass-panel-elevated p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-glass-text">{week.weekLabel}</h2>
            <p className="mt-0.5 text-sm text-glass-text-muted">{week.dateRange}</p>
          </div>
          <div className="flex gap-5">
            <WeekHeroStat label="Activities" value={String(week.totals.activities)} />
            <WeekHeroStat label="Distance" value={`${week.totals.distanceKm.toFixed(1)} km`} />
            <WeekHeroStat label="Duration" value={formatDuration(week.totals.durationSec)} />
            <WeekHeroStat
              label="Elevation"
              value={`${String(Math.round(week.totals.elevationGainM))} m`}
            />
          </div>
        </div>
      </section>

      {/* Week-over-week comparison */}
      {week.prevTotals && <WeekComparison current={week.totals} previous={week.prevTotals} />}

      {/* AI weekly summary */}
      <section className="glass-panel border-accent/20 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
            <svg
              className="h-4 w-4 text-accent"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
              Weekly AI Summary
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">{week.aiSummary}</p>
          </div>
        </div>
      </section>

      {/* Duration bar chart */}
      <section className="glass-panel cursor-pointer p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-glass-text-dim">
          Daily Time
        </h3>
        <div
          className="h-32"
          style={{ WebkitTapHighlightColor: 'transparent' }}
          onClick={(e) => {
            const svg = (e.currentTarget as HTMLElement).querySelector('.recharts-surface');
            if (!svg) return;
            const rect = svg.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const ratio = x / rect.width;
            const idx = Math.min(Math.floor(ratio * 7), 6);
            handleSelect(idx);
          }}
        >
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="name"
                stroke="var(--chart-grid)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--chart-grid)"
                tick={{ fill: 'var(--chart-tick)', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) => `${String(v)}m`}
              />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Heart rate zone distribution */}
      {heartRateStream &&
        heartRateStream.length > 0 &&
        heartRateZones &&
        heartRateZones.length > 0 && (
          <ZoneDistribution
            heartRateStream={heartRateStream}
            zones={heartRateZones}
            totalTimeSec={week.totals.durationSec}
          />
        )}

      {/* Day selector strip */}
      <WeekDayBar days={week.days} selectedIndex={selectedDay} onSelect={handleSelect} />

      {/* Day detail (expanded when an activity day is selected) */}
      {selectedDay !== null &&
        week.days[selectedDay] !== undefined &&
        week.days[selectedDay].hasActivity && (
          <div className="animate-in fade-in slide-in-from-top-2 duration-200">
            <DayDetail day={week.days[selectedDay]} />
          </div>
        )}

      {/* Hint when no day is selected */}
      {selectedDay === null && (
        <section className="flex items-center gap-2 px-1 text-xs text-glass-text-dim">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
            />
          </svg>
          <span>Tap a day above or a bar in the chart to see activity details</span>
        </section>
      )}
    </main>
  );
}

interface WeekHeroStatProps {
  label: string;
  value: string;
}

function WeekHeroStat({ label, value }: WeekHeroStatProps): ReactNode {
  return (
    <div className="text-right">
      <p className="text-[10px] font-medium uppercase tracking-widest text-glass-text-dim">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-glass-text">
        {value}
      </p>
    </div>
  );
}

interface WeekComparisonProps {
  current: WeekTotals;
  previous: WeekTotals;
}

interface ComparisonMetric {
  label: string;
  current: string;
  pctChange: number;
  higherIsBetter: boolean;
}

function pctChange(curr: number, prev: number): number {
  if (prev === 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function WeekComparison({ current, previous }: WeekComparisonProps): ReactNode {
  const metrics: ComparisonMetric[] = [
    {
      label: 'Distance',
      current: `${current.distanceKm.toFixed(1)} km`,
      pctChange: pctChange(current.distanceKm, previous.distanceKm),
      higherIsBetter: true,
    },
    {
      label: 'Duration',
      current: formatDuration(current.durationSec),
      pctChange: pctChange(current.durationSec, previous.durationSec),
      higherIsBetter: true,
    },
    {
      label: 'Calories',
      current: `${String(Math.round(current.calories))} kcal`,
      pctChange: pctChange(current.calories, previous.calories),
      higherIsBetter: true,
    },
    {
      label: 'Elevation',
      current: `${String(Math.round(current.elevationGainM))} m`,
      pctChange: pctChange(current.elevationGainM, previous.elevationGainM),
      higherIsBetter: true,
    },
    {
      label: 'Sessions',
      current: String(current.activities),
      pctChange: pctChange(current.activities, previous.activities),
      higherIsBetter: true,
    },
    {
      label: 'Load',
      current: `${String(Math.round(current.effort))} TRIMP`,
      pctChange: pctChange(current.effort, previous.effort),
      higherIsBetter: true,
    },
  ];

  return (
    <section className="glass-panel p-4">
      <h3 className="mb-3 text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
        vs Last Week
      </h3>
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
        {metrics.map((m) => (
          <ComparisonCard key={m.label} metric={m} />
        ))}
      </div>
    </section>
  );
}

function ComparisonCard({ metric }: { metric: ComparisonMetric }): ReactNode {
  const { label, current, pctChange: pct, higherIsBetter } = metric;
  const isPositive = higherIsBetter ? pct > 0 : pct < 0;
  const isNeutral = Math.abs(pct) < 1;
  const color = isNeutral
    ? 'text-glass-text-dim'
    : isPositive
      ? 'text-emerald-400'
      : 'text-amber-400';
  const arrow = pct > 0 ? '\u2191' : pct < 0 ? '\u2193' : '';

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wider text-glass-text-dim">
        {label}
      </span>
      <span className="text-sm font-semibold tabular-nums text-glass-text">{current}</span>
      {!isNeutral && (
        <span className={`text-[10px] font-medium tabular-nums ${color}`}>
          {arrow} {Math.abs(pct).toFixed(0)}%
        </span>
      )}
    </div>
  );
}
