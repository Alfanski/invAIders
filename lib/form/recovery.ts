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

export interface RecoveryInput {
  hoursSinceLastActivity: number;
  lastActivityTrimp: number;
  tsb?: number;
  acwr?: number;
}

/**
 * Enhanced recovery model that factors in training form signals when available.
 *
 * Base: time-since-last-activity / TRIMP-band target (original model).
 * Modifier 1 (TSB): negative TSB slows recovery (fatigued athletes recover slower),
 *   positive TSB boosts it (well-rested athletes recover faster).
 * Modifier 2 (ACWR): ratio > 1.5 ("danger zone") penalizes recovery;
 *   ratio in 0.8-1.3 ("sweet spot") gives a small bonus.
 */
export function computeRecovery(
  hoursSinceLastActivity: number,
  lastActivityTrimp: number,
  formSignals?: { tsb?: number; acwr?: number },
): RecoveryState {
  const band = getBand(lastActivityTrimp);
  const targetHours = (band.minHours + band.maxHours) / 2;
  let rawPct = Math.min(1, hoursSinceLastActivity / targetHours);

  if (formSignals) {
    const { tsb, acwr } = formSignals;

    if (tsb !== undefined) {
      // TSB modifier: ranges roughly from -0.15 (very fatigued) to +0.10 (fresh)
      const tsbModifier = Math.max(-0.15, Math.min(0.1, tsb / 200));
      rawPct = Math.min(1, Math.max(0, rawPct + tsbModifier));
    }

    if (acwr !== undefined) {
      if (acwr > 1.5) {
        // High ACWR = acute spike well above chronic baseline, penalize
        const penalty = Math.min(0.15, (acwr - 1.5) * 0.3);
        rawPct = Math.max(0, rawPct - penalty);
      } else if (acwr >= 0.8 && acwr <= 1.3) {
        rawPct = Math.min(1, rawPct + 0.03);
      }
    }
  }

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
