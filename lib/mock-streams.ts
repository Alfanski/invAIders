import type { StreamPoint, WorkoutStreams } from '@/types/dashboard';

const SAMPLE_INTERVAL_SEC = 30;

function generateStream(
  durationSec: number,
  baseFn: (progress: number) => number,
  noise: number,
): readonly StreamPoint[] {
  const points: StreamPoint[] = [];
  const numPoints = Math.floor(durationSec / SAMPLE_INTERVAL_SEC);

  for (let i = 0; i <= numPoints; i++) {
    const timeSec = i * SAMPLE_INTERVAL_SEC;
    const progress = timeSec / durationSec;
    const jitter = (Math.sin(i * 2.7) + Math.cos(i * 4.3)) * noise * 0.5;
    points.push({ timeSec, value: Math.round((baseFn(progress) + jitter) * 10) / 10 });
  }

  return points;
}

export function generateMockStreams(durationSec: number): WorkoutStreams {
  const heartRate = generateStream(
    durationSec,
    (p) => {
      if (p < 0.08) return 120 + p * 400;
      if (p > 0.92) return 160 - (p - 0.92) * 500;
      const base = 148 + Math.sin(p * Math.PI * 3) * 8;
      return base + p * 12;
    },
    6,
  );

  const pace = generateStream(
    durationSec,
    (p) => {
      if (p < 0.05) return 330;
      if (p > 0.9) return 280 - (p - 0.9) * 100;
      return 300 - p * 20 + Math.sin(p * Math.PI * 4) * 10;
    },
    5,
  );

  const elevation = generateStream(
    durationSec,
    (p) => {
      return 45 + Math.sin(p * Math.PI * 2) * 25 + Math.sin(p * Math.PI * 5) * 10 + p * 15;
    },
    2,
  );

  const cadence = generateStream(
    durationSec,
    (p) => {
      if (p < 0.05) return 165 + p * 100;
      return 170 + Math.sin(p * Math.PI * 6) * 4 + p * 3;
    },
    2,
  );

  return { heartRate, pace, elevation, cadence };
}
