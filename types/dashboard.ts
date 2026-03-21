export interface WorkoutStats {
  distanceKm: number;
  durationSec: number;
  paceSecPerKm: number;
  averageHeartRate: number;
  elevationGainM: number;
  cadenceRpm: number;
  calories: number;
  effort: number;
  temperatureC: number;
}

export interface StreamPoint {
  timeSec: number;
  value: number;
}

export interface StreamSummary {
  min: number;
  avg: number;
  max: number;
}

export type MetricKey =
  | 'heartRate'
  | 'pace'
  | 'elevation'
  | 'cadence'
  | 'distance'
  | 'duration'
  | 'calories'
  | 'effort'
  | 'temperature';

export interface MetricDefinition {
  key: MetricKey;
  label: string;
  value: string;
  unit: string;
  color: string;
  stream?: readonly StreamPoint[];
  summary?: StreamSummary;
}

export interface WorkoutSummary {
  title: string;
  dateLabel: string;
  stats: WorkoutStats;
  streams?: WorkoutStreams;
}

export interface WorkoutStreams {
  heartRate: readonly StreamPoint[];
  pace: readonly StreamPoint[];
  elevation: readonly StreamPoint[];
  cadence: readonly StreamPoint[];
}

export interface DaySummary {
  dayLabel: string;
  dayShort: string;
  date: string;
  hasActivity: boolean;
  activityType?: string | undefined;
  activityName?: string | undefined;
  distanceKm?: number | undefined;
  durationSec?: number | undefined;
  paceSecPerKm?: number | undefined;
  averageHeartRate?: number | undefined;
  elevationGainM?: number | undefined;
  calories?: number | undefined;
  effort?: number | undefined;
}

export interface WeekData {
  weekLabel: string;
  dateRange: string;
  days: readonly DaySummary[];
  totals: {
    activities: number;
    distanceKm: number;
    durationSec: number;
    elevationGainM: number;
    calories: number;
    effort: number;
  };
  aiSummary: string;
}
