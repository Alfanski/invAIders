import type { ReactNode } from 'react';

import { generateMockStreams } from '@/lib/mock-streams';
import { WorkoutView } from '@/components/dashboard/workout-view';
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
  streams: generateMockStreams(3025),
};

const COACHING_INSIGHT =
  'Strong negative split today -- your second half was 12s/km faster than the first. ' +
  'Heart rate stayed controlled in Z2-Z3 throughout with a clean aerobic drift pattern. ' +
  'Cadence was steady at 172 rpm which is excellent for this pace. ' +
  'Recovery recommendation: easy 45min Z1-Z2 tomorrow, focus on low HR.';

export default function DashboardPage(): ReactNode {
  return (
    <WorkoutView
      title={MOCK_WORKOUT.title}
      dateLabel={MOCK_WORKOUT.dateLabel}
      stats={MOCK_WORKOUT.stats}
      streams={MOCK_WORKOUT.streams ?? generateMockStreams(MOCK_WORKOUT.stats.durationSec)}
      coachingInsight={COACHING_INSIGHT}
    />
  );
}
