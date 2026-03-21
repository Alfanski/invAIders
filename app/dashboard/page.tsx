import type { ReactNode } from 'react';

import { StatCardGrid } from '@/components/dashboard/stat-card-grid';
import type { WorkoutSummary } from '@/types/dashboard';

const MOCK_WORKOUT: WorkoutSummary = {
  title: 'Morning Run',
  dateLabel: 'Sat Mar 21, 2026',
  stats: {
    distanceKm: 10.2,
    durationSec: 3025,
    paceSecPerKm: 297,
    averageHeartRate: 154,
    elevationGainM: 84,
    cadenceRpm: 172,
    calories: 742,
    effort: 93,
    temperatureC: 9,
  },
};

export default function DashboardPage(): ReactNode {
  return (
    <main className="space-y-6">
      <section className="glass-panel-elevated p-5">
        <h2 className="text-xl font-semibold text-white">{MOCK_WORKOUT.title}</h2>
        <p className="text-sm text-glass-text-muted">{MOCK_WORKOUT.dateLabel}</p>
      </section>

      <StatCardGrid stats={MOCK_WORKOUT.stats} />

      <section className="glass-panel p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
          AI Coaching
        </h3>
        <p className="text-sm leading-relaxed text-glass-text-muted">
          Strong negative split today -- your second half was 12s/km faster than the first. Heart
          rate stayed controlled in Z2-Z3 throughout. Recovery recommendation: easy 45min Z1-Z2
          tomorrow.
        </p>
      </section>
    </main>
  );
}
