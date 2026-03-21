export interface UnitConverter {
  formatDistance(meters: number): string;
  formatDuration(totalSeconds: number): string;
  formatPace(secondsPerKm: number): string;
  formatSpeed(metersPerSecond: number): string;
  formatTemperature(celsius: number): string;
  formatElevation(meters: number): string;
}

export type MeasurementSystem = 'metric' | 'imperial';
