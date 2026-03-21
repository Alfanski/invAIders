import type { ReactNode } from 'react';

import { formatDuration, formatPace, formatTemperature } from '@/lib/units';
import type { WorkoutStats } from '@/types/dashboard';

import { StatCard } from './stat-card';

interface StatCardGridProps {
  stats: WorkoutStats;
}

export function StatCardGrid({ stats }: Readonly<StatCardGridProps>): ReactNode {
  return (
    <section className="grid grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
      <StatCard label="Distance" value={`${stats.distanceKm.toFixed(1)} km`} />
      <StatCard label="Duration" value={formatDuration(stats.durationSec)} />
      <StatCard label="Avg Pace" value={formatPace(stats.paceSecPerKm)} />
      <StatCard label="Avg HR" value={`${String(stats.averageHeartRate)} bpm`} />
      <StatCard label="Elevation" value={`${String(Math.round(stats.elevationGainM))} m`} />
      <StatCard label="Cadence" value={`${String(Math.round(stats.cadenceRpm))} rpm`} />
      <StatCard label="Calories" value={`${String(Math.round(stats.calories))} kcal`} />
      <StatCard label="Effort" value={`${String(Math.round(stats.effort))} TRIMP`} />
      <StatCard label="Temperature" value={formatTemperature(stats.temperatureC)} />
    </section>
  );
}
