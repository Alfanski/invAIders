import type { RecoveryState } from '@/types/form';

interface RecoveryBand {
  maxTrimp: number;
  minHours: number;
  maxHours: number;
}

const RECOVERY_BANDS: readonly RecoveryBand[] = [
  { maxTrimp: 50, minHours: 12, maxHours: 18 },
  { maxTrimp: 100, minHours: 24, maxHours: 36 },
  { maxTrimp: 200, minHours: 36, maxHours: 48 },
  { maxTrimp: Infinity, minHours: 48, maxHours: 72 },
];

const ACTIVITY_TYPES = [
  { label: 'Easy run', trimpThreshold: 0.4 },
  { label: 'Moderate run', trimpThreshold: 0.65 },
  { label: 'Tempo run', trimpThreshold: 0.8 },
  { label: 'Intervals', trimpThreshold: 0.95 },
  { label: 'Race effort', trimpThreshold: 1.0 },
] as const;

function getBand(trimp: number): RecoveryBand {
  for (const band of RECOVERY_BANDS) {
    if (trimp <= band.maxTrimp) return band;
  }
  const last = RECOVERY_BANDS[RECOVERY_BANDS.length - 1];
  if (!last) throw new Error('Recovery bands empty');
  return last;
}

export function computeRecovery(
  hoursSinceLastActivity: number,
  lastActivityTrimp: number,
): RecoveryState {
  const band = getBand(lastActivityTrimp);
  const targetHours = (band.minHours + band.maxHours) / 2;
  const rawPct = Math.min(1, hoursSinceLastActivity / targetHours);
  const recoveryPct = Math.round(rawPct * 100);

  const readyFor: string[] = [];
  const notReadyFor: string[] = [];

  for (const activity of ACTIVITY_TYPES) {
    if (rawPct >= activity.trimpThreshold) {
      readyFor.push(activity.label);
    } else {
      notReadyFor.push(activity.label);
    }
  }

  return {
    hoursSinceLastActivity,
    lastActivityTrimp,
    recoveryPct,
    readyFor,
    notReadyFor,
  };
}
