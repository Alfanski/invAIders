'use client';

import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

import type { StreamPoint, StreamSummary } from '@/types/dashboard';

interface MetricChartProps {
  stream: readonly StreamPoint[];
  summary: StreamSummary;
  color: string;
  label: string;
  unit: string;
  formatValue?: ((value: number) => string) | undefined;
  invertY?: boolean | undefined;
}

function defaultFormatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${String(m)} min`;
}

function defaultFormatValue(value: number, unit: string): string {
  return `${String(Math.round(value))} ${unit}`;
}

interface TooltipPayloadItem {
  value: number;
  payload: StreamPoint;
}

interface CustomTooltipProps {
  active?: boolean | undefined;
  payload?: readonly TooltipPayloadItem[] | undefined;
  unit: string;
  formatValue?: ((value: number) => string) | undefined;
}

function ChartTooltip({ active, payload, unit, formatValue }: CustomTooltipProps): ReactNode {
  if (!active || !payload?.[0]) return null;

  const point = payload[0];
  const timeLabel = defaultFormatTime(point.payload.timeSec);
  const valueLabel = formatValue ? formatValue(point.value) : defaultFormatValue(point.value, unit);

  return (
    <div className="rounded-lg border border-glass-border bg-[#1a1830] px-3 py-2 text-xs shadow-xl">
      <p className="text-glass-text-muted">{timeLabel}</p>
      <p className="mt-0.5 font-semibold text-white">{valueLabel}</p>
    </div>
  );
}

export function MetricChart({
  stream,
  summary,
  color,
  label,
  unit,
  formatValue,
  invertY = false,
}: Readonly<MetricChartProps>): ReactNode {
  const data = stream.map((p) => ({ timeSec: p.timeSec, value: p.value }));

  const formatSummaryValue = formatValue ?? ((v: number) => defaultFormatValue(v, unit));

  return (
    <div className="glass-panel p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{label} Over Time</h4>
        <div className="flex gap-4 text-xs text-glass-text-muted">
          <span>
            Min <span className="font-medium text-white">{formatSummaryValue(summary.min)}</span>
          </span>
          <span>
            Avg <span className="font-medium text-white">{formatSummaryValue(summary.avg)}</span>
          </span>
          <span>
            Max <span className="font-medium text-white">{formatSummaryValue(summary.max)}</span>
          </span>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id={`gradient-${label}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="timeSec"
              tickFormatter={defaultFormatTime}
              stroke="rgba(255,255,255,0.15)"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              reversed={invertY}
              stroke="rgba(255,255,255,0.15)"
              tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => (formatValue ? formatValue(v) : String(Math.round(v)))}
            />
            <Tooltip
              content={<ChartTooltip unit={unit} formatValue={formatValue} />}
              cursor={{ stroke: 'rgba(255,255,255,0.1)' }}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={2}
              fill={`url(#gradient-${label})`}
              dot={false}
              activeDot={{ r: 4, fill: color, stroke: '#1a1830', strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
