import type { ActivityBucket } from '@/lib/sport-config';
import type { AnalysisData, WorkoutStreams } from '@/types/dashboard';

export function buildStreams(
  stream: {
    timeSec: number[];
    heartrateBpm?: number[];
    velocitySmooth?: number[];
    altitudeM?: number[];
    cadenceRpm?: number[];
  } | null,
  bucket: ActivityBucket = 'run',
): WorkoutStreams | null {
  if (!stream) return null;

  const time = stream.timeSec;

  function toPoints(data: number[] | undefined): { timeSec: number; value: number }[] {
    if (!data) return [];
    return data.map((v, i) => ({ timeSec: time[i] ?? 0, value: v }));
  }

  function velocityToSpeedValue(data: number[] | undefined): { timeSec: number; value: number }[] {
    if (!data) return [];
    if (bucket === 'ride') {
      return data.map((v, i) => ({
        timeSec: time[i] ?? 0,
        value: v * 3.6,
      }));
    }
    return data.map((v, i) => ({
      timeSec: time[i] ?? 0,
      value: v > 0 ? 1000 / v : 0,
    }));
  }

  return {
    heartRate: toPoints(stream.heartrateBpm),
    pace: velocityToSpeedValue(stream.velocitySmooth),
    elevation: toPoints(stream.altitudeM),
    cadence: toPoints(stream.cadenceRpm),
  };
}

export function formatDateLabel(startDate: string): string {
  const d = new Date(startDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function toAnalysisData(
  analysis: {
    executiveSummary: string;
    positives: string[];
    improvements: string[];
    splitAnalysis?: { trend: string; comment: string } | undefined;
    nextSession?:
      | { type: string; durationMin: number; intensity: string; description: string }
      | undefined;
    weatherNote?: string | undefined;
    effortScore?: number | undefined;
  } | null,
): AnalysisData | null {
  if (!analysis) return null;
  return {
    executiveSummary: analysis.executiveSummary,
    positives: analysis.positives,
    improvements: analysis.improvements,
    splitAnalysis: analysis.splitAnalysis ?? null,
    nextSession: analysis.nextSession ?? null,
    weatherNote: analysis.weatherNote ?? null,
    effortScore: analysis.effortScore ?? null,
  };
}
