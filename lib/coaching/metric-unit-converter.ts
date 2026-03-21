import type { UnitConverter } from '@/lib/domain/unit-converter';

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export class MetricUnitConverter implements UnitConverter {
  formatDistance(meters: number): string {
    const km = meters / 1000;
    return `${km.toFixed(1)} km`;
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
    const minutes = Math.floor(secondsPerKm / SECONDS_PER_MINUTE);
    const seconds = Math.round(secondsPerKm % SECONDS_PER_MINUTE);

    return `${String(minutes)}:${seconds.toString().padStart(2, '0')} /km`;
  }

  formatSpeed(metersPerSecond: number): string {
    const kmh = metersPerSecond * 3.6;
    return `${kmh.toFixed(1)} km/h`;
  }

  formatTemperature(celsius: number): string {
    return `${String(Math.round(celsius))} C`;
  }

  formatElevation(meters: number): string {
    return `${String(Math.round(meters))} m`;
  }
}
