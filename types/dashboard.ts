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

export interface WorkoutSummary {
  title: string;
  dateLabel: string;
  stats: WorkoutStats;
}
