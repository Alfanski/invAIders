'use client';

import type { ReactNode } from 'react';
import {
  Area,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import type { DailyFormPoint } from '@/types/form';

interface FitnessChartProps {
  series: readonly DailyFormPoint[];
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

interface TooltipPayloadEntry {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: Readonly<{
  active?: boolean;
  payload?: readonly TooltipPayloadEntry[];
  label?: string;
}>): ReactNode {
  if (!active || !payload?.length || !label) return null;
  return (
    <div className="glass-card border border-glass-border p-2.5 text-xs">
      <p className="mb-1.5 font-medium text-white">{formatDate(label)}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(1)}
        </p>
      ))}
    </div>
  );
}

export function FitnessChart({ series }: Readonly<FitnessChartProps>): ReactNode {
  const tickInterval = Math.floor(series.length / 5);

  return (
    <section className="glass-panel p-5">
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-widest text-glass-text-dim">
        8-Week Fitness / Fatigue / Form
      </h3>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={series as DailyFormPoint[]} margin={{ left: -20, right: 4 }}>
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            interval={tickInterval}
          />
          <YAxis
            tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeDasharray="4 4" />

          <Area
            type="monotone"
            dataKey="tsb"
            name="Form (TSB)"
            fill="rgba(34, 197, 94, 0.15)"
            stroke="#22c55e"
            strokeWidth={1.5}
          />
          <Line
            type="monotone"
            dataKey="ctl"
            name="Fitness (CTL)"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
          />
          <Line
            type="monotone"
            dataKey="atl"
            name="Fatigue (ATL)"
            stroke="#f43f5e"
            strokeWidth={2}
            strokeDasharray="6 4"
            dot={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </section>
  );
}
