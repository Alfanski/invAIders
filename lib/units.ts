const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

export function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / SECONDS_PER_HOUR);
  const minutes = Math.floor((totalSeconds % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
  const seconds = Math.floor(totalSeconds % SECONDS_PER_MINUTE);

  if (hours > 0) {
    return `${String(hours)}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }

  return `${String(minutes)}:${seconds.toString().padStart(2, '0')}`;
}

export function formatPace(secondsPerKm: number): string {
  const minutes = Math.floor(secondsPerKm / SECONDS_PER_MINUTE);
  const seconds = Math.round(secondsPerKm % SECONDS_PER_MINUTE);

  return `${String(minutes)}:${seconds.toString().padStart(2, '0')} /km`;
}

export function formatTemperature(tempCelsius: number): string {
  return `${String(Math.round(tempCelsius))} C`;
}
