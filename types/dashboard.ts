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

export interface StravaSplit {
  distance: number;
  elapsed_time: number;
  elevation_difference: number;
  moving_time: number;
  split: number;
  average_speed: number;
  average_heartrate?: number;
  pace_zone?: number;
}

export interface AnalysisData {
  executiveSummary: string;
  positives: string[];
  improvements: string[];
  splitAnalysis?: { trend: string; comment: string } | null;
  nextSession?: {
    type: string;
    durationMin: number;
    intensity: string;
    description: string;
  } | null;
  weatherNote?: string | null;
  effortScore?: number | null;
}

export interface HeartRateZone {
  min: number;
  max: number;
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
