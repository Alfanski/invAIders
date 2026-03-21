'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { formatDuration, formatPace } from '@/lib/units';
import type {
  AnalysisData,
  HeartRateZone,
  MetricDefinition,
  MetricKey,
  StravaSplit,
  StreamPoint,
  StreamSummary,
  WorkoutStats,
  WorkoutStreams,
} from '@/types/dashboard';

import { CoachingBreakdown } from './coaching-breakdown';
import { MetricCard } from './metric-card';
import { MetricChart } from './metric-chart';
import { RouteMap } from './route-map';
import { SplitTable } from './split-table';
import { ZoneDistribution } from './zone-distribution';

interface WorkoutViewProps {
  title: string;
  dateLabel: string;
  stats: WorkoutStats;
  streams: WorkoutStreams;
  coachingInsight: string;
  splits?: readonly StravaSplit[] | undefined;
  latlng?: readonly number[][] | undefined;
  altitude?: readonly number[] | undefined;
  distance?: readonly number[] | undefined;
  analysis?: AnalysisData | null | undefined;
  heartRateZones?: readonly HeartRateZone[] | undefined;
  heartRateStream?: readonly number[] | undefined;
  streamsLoading?: boolean | undefined;
}

function computeSummary(stream: readonly StreamPoint[]): StreamSummary {
  let min = Infinity;
  let max = -Infinity;
  let sum = 0;

  for (const p of stream) {
    if (p.value < min) min = p.value;
    if (p.value > max) max = p.value;
    sum += p.value;
  }

  return {
    min: Math.round(min),
    avg: Math.round(sum / stream.length),
    max: Math.round(max),
  };
}

function formatPaceValue(secPerKm: number): string {
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${String(m)}:${s.toString().padStart(2, '0')} /km`;
}

const CHART_CONFIGS: Record<
  string,
  { color: string; unit: string; invertY?: boolean; formatValue?: (v: number) => string }
> = {
  heartRate: { color: '#f87171', unit: 'bpm' },
  pace: { color: '#34d399', unit: '/km', invertY: true, formatValue: formatPaceValue },
  elevation: { color: '#60a5fa', unit: 'm' },
  cadence: { color: '#fbbf24', unit: 'rpm' },
};

export function WorkoutView({
  title,
  dateLabel,
  stats,
  streams,
  coachingInsight,
  splits,
  latlng,
  altitude,
  distance,
  analysis,
  heartRateZones,
  heartRateStream,
  streamsLoading = false,
}: Readonly<WorkoutViewProps>): ReactNode {
  const [expandedMetric, setExpandedMetric] = useState<MetricKey | null>(null);

  const toggleMetric = useCallback((key: MetricKey) => {
    setExpandedMetric((prev) => (prev === key ? null : key));
  }, []);

  const metrics: readonly MetricDefinition[] = useMemo(
    () => [
      {
        key: 'heartRate' as const,
        label: 'Avg HR',
        value: `${String(stats.averageHeartRate)} bpm`,
        unit: 'bpm',
        color: '#f87171',
        stream: streams.heartRate,
        summary: computeSummary(streams.heartRate),
      },
      {
        key: 'pace' as const,
        label: 'Avg Pace',
        value: formatPace(stats.paceSecPerKm),
        unit: '/km',
        color: '#34d399',
        stream: streams.pace,
        summary: computeSummary(streams.pace),
      },
      {
        key: 'elevation' as const,
        label: 'Elevation',
        value: `${String(Math.round(stats.elevationGainM))} m`,
        unit: 'm',
        color: '#60a5fa',
        stream: streams.elevation,
        summary: computeSummary(streams.elevation),
      },
      {
        key: 'cadence' as const,
        label: 'Cadence',
        value: `${String(Math.round(stats.cadenceRpm))} rpm`,
        unit: 'rpm',
        color: '#fbbf24',
        stream: streams.cadence,
        summary: computeSummary(streams.cadence),
      },
      {
        key: 'calories' as const,
        label: 'Calories',
        value: `${String(Math.round(stats.calories))} kcal`,
        unit: 'kcal',
        color: '#94a3b8',
      },
      {
        key: 'effort' as const,
        label: 'Effort',
        value: `${String(Math.round(stats.effort))} TRIMP`,
        unit: 'TRIMP',
        color: '#c084fc',
      },
    ],
    [stats, streams],
  );

  return (
    <main className="space-y-5">
      {/* Hero section */}
      <section className="glass-panel-elevated p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-white">{title}</h2>
            <p className="mt-0.5 text-sm text-glass-text-muted">{dateLabel}</p>
          </div>
          <div className="flex gap-5">
            <HeroStat label="Distance" value={`${stats.distanceKm.toFixed(1)} km`} />
            <HeroStat label="Duration" value={formatDuration(stats.durationSec)} />
            <HeroStat label="Pace" value={formatPace(stats.paceSecPerKm)} />
          </div>
        </div>
      </section>

      {/* AI coaching -- full breakdown or simple fallback */}
      {analysis ? (
        <CoachingBreakdown analysis={analysis} />
      ) : (
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
                AI Coach Analysis
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">
                {coachingInsight}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* Stream loading indicator */}
      {streamsLoading && (
        <section className="glass-panel flex items-center gap-3 p-4">
          <div className="flex gap-1">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:200ms]" />
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent [animation-delay:400ms]" />
          </div>
          <span className="text-xs text-glass-text-muted">Loading stream data from Strava...</span>
        </section>
      )}

      {/* Interactive metric cards */}
      <section>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
          {metrics.map((metric) => (
            <MetricCard
              key={metric.key}
              label={metric.label}
              value={metric.value}
              color={metric.color}
              expandable={metric.stream !== undefined}
              expanded={expandedMetric === metric.key}
              onToggle={() => {
                toggleMetric(metric.key);
              }}
            />
          ))}
        </div>

        {/* Expanded chart panel */}
        {expandedMetric &&
          (() => {
            const active = metrics.find((m) => m.key === expandedMetric);
            if (!active?.stream || !active.summary) return null;
            const config = CHART_CONFIGS[active.key];
            if (!config) return null;

            return (
              <div className="mt-3 animate-in fade-in slide-in-from-top-2 duration-200">
                <MetricChart
                  stream={active.stream}
                  summary={active.summary}
                  color={config.color}
                  label={active.label}
                  unit={config.unit}
                  {...(config.formatValue !== undefined ? { formatValue: config.formatValue } : {})}
                  {...(config.invertY !== undefined ? { invertY: config.invertY } : {})}
                />
              </div>
            );
          })()}
      </section>

      {/* Split table */}
      {splits && splits.length > 0 && <SplitTable splits={splits} />}

      {/* HR zone distribution */}
      {heartRateZones &&
        heartRateZones.length > 0 &&
        heartRateStream &&
        heartRateStream.length > 0 && (
          <ZoneDistribution
            heartRateStream={heartRateStream}
            zones={heartRateZones}
            totalTimeSec={stats.durationSec}
          />
        )}

      {/* GPS route map + elevation profile */}
      {latlng && latlng.length > 1 && (
        <RouteMap latlng={latlng} altitude={altitude} distance={distance} />
      )}

      {/* Temperature as subtle footer detail */}
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
            d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <span>{String(Math.round(stats.temperatureC))} C</span>
        <span className="text-glass-text-dim/50">|</span>
        <span>Tap any highlighted metric to see the training graph</span>
      </section>
    </main>
  );
}

interface HeroStatProps {
  label: string;
  value: string;
}

function HeroStat({ label, value }: HeroStatProps): ReactNode {
  return (
    <div className="text-right">
      <p className="text-[10px] font-medium uppercase tracking-widest text-glass-text-dim">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold tabular-nums tracking-tight text-white">{value}</p>
    </div>
  );
}
