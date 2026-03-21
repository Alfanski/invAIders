'use client';

import dynamic from 'next/dynamic';
import type { ReactNode } from 'react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const LeafletMap = dynamic(() => import('./route-map-leaflet'), {
  ssr: false,
  loading: () => <div className="h-64 animate-pulse rounded-2xl bg-glass" />,
});

interface RouteMapProps {
  latlng: readonly number[][];
  altitude?: readonly number[] | undefined;
  distance?: readonly number[] | undefined;
}

export function RouteMap({ latlng, altitude, distance }: Readonly<RouteMapProps>): ReactNode {
  if (latlng.length < 2) return null;

  return (
    <section className="space-y-3">
      <div className="glass-panel overflow-hidden p-0">
        <div className="px-4 pt-4">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
            Route
          </h3>
        </div>
        <div className="mt-3">
          <LeafletMap latlng={latlng} />
        </div>
      </div>

      {altitude && distance && altitude.length > 1 && distance.length > 1 && (
        <ElevationProfile altitude={altitude} distance={distance} />
      )}
    </section>
  );
}

interface ElevationProfileProps {
  altitude: readonly number[];
  distance: readonly number[];
}

interface ElevProfileTooltipPayloadItem {
  value: number;
  payload: { distance: number; altitude: number };
}

interface ElevProfileTooltipProps {
  active?: boolean;
  payload?: readonly ElevProfileTooltipPayloadItem[];
}

function ElevProfileTooltip({ active, payload }: ElevProfileTooltipProps): ReactNode {
  if (!active || !payload?.[0]) return null;
  const pt = payload[0];
  return (
    <div
      className="rounded-lg border border-glass-border px-3 py-2 text-xs shadow-xl"
      style={{ backgroundColor: 'var(--surface-tooltip)' }}
    >
      <p className="text-glass-text-muted">{pt.payload.distance.toFixed(1)} km</p>
      <p className="mt-0.5 font-semibold text-glass-text">{Math.round(pt.value)} m</p>
    </div>
  );
}

function ElevationProfile({ altitude, distance }: ElevationProfileProps): ReactNode {
  const step = Math.max(1, Math.floor(altitude.length / 200));
  const data: { distance: number; altitude: number }[] = [];
  for (let i = 0; i < altitude.length; i += step) {
    data.push({
      distance: (distance[i] ?? 0) / 1000,
      altitude: altitude[i] ?? 0,
    });
  }

  return (
    <div className="glass-panel p-4">
      <h4 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
        Elevation Profile
      </h4>
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="gradient-elev-profile" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#60a5fa" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="distance"
              stroke="var(--chart-grid)"
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${v.toFixed(0)} km`}
            />
            <YAxis
              stroke="var(--chart-grid)"
              tick={{ fill: 'var(--chart-tick)', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => `${String(Math.round(v))}m`}
            />
            <Tooltip content={<ElevProfileTooltip />} cursor={{ stroke: 'var(--chart-cursor)' }} />
            <Area
              type="monotone"
              dataKey="altitude"
              stroke="#60a5fa"
              strokeWidth={1.5}
              fill="url(#gradient-elev-profile)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
