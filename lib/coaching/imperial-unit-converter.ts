import type { UnitConverter } from '@/lib/domain/unit-converter';

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

export class ImperialUnitConverter implements UnitConverter {
  formatDistance(meters: number): string {
    const miles = meters / METERS_PER_MILE;
    return `${miles.toFixed(1)} mi`;
  }

  formatDuration(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
    const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);

    if (hours > 0) {
      return `${String(hours)}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }

    return `${String(minutes)}:${seconds.toString().padStart(2, '0')}`;
  }

  formatPace(secondsPerKm: number): string {
    const secondsPerMile = secondsPerKm * (METERS_PER_MILE / 1000);
    const minutes = Math.floor(secondsPerMile / SECONDS_PER_MINUTE);
    const seconds = Math.round(secondsPerMile % SECONDS_PER_MINUTE);

    return `${String(minutes)}:${seconds.toString().padStart(2, '0')} /mi`;
  }

  formatSpeed(metersPerSecond: number): string {
    const mph = (metersPerSecond * SECONDS_PER_HOUR) / METERS_PER_MILE;
    return `${mph.toFixed(1)} mph`;
  }

  formatTemperature(celsius: number): string {
    const fahrenheit = celsius * 1.8 + 32;
    return `${String(Math.round(fahrenheit))} F`;
  }

  formatElevation(meters: number): string {
    const feet = meters / METERS_PER_FOOT;
    return `${String(Math.round(feet))} ft`;
  }
}
