import type { FormZone } from '@/lib/domain/coaching-engine';

export interface ZoneBoundary {
  zone: FormZone;
  label: string;
  shortLabel: string;
  min: number;
  max: number;
}

const ZONE_BOUNDARIES: readonly ZoneBoundary[] = [
  {
    zone: 'overreaching',
    label: 'Overreaching -- injury risk',
    shortLabel: 'Overreaching',
    min: -40,
    max: -30,
  },
  {
    zone: 'fatigued',
    label: 'Fatigued -- absorbing load',
    shortLabel: 'Fatigued',
    min: -30,
    max: -10,
  },
  {
    zone: 'balanced',
    label: 'Balanced -- normal training',
    shortLabel: 'Balanced',
    min: -10,
    max: 5,
  },
  {
    zone: 'race_ready',
    label: 'Race Ready -- peak form',
    shortLabel: 'Race Ready',
    min: 5,
    max: 15,
  },
  { zone: 'fresh', label: 'Fresh -- possibly undertrained', shortLabel: 'Fresh', min: 15, max: 25 },
] as const;

export function getZoneBoundary(zone: FormZone): ZoneBoundary {
  const boundary = ZONE_BOUNDARIES.find((z) => z.zone === zone);
  if (!boundary) {
    const fallback = ZONE_BOUNDARIES[2];
    if (!fallback) throw new Error('Zone boundaries missing');
    return fallback;
  }
  return boundary;
}

export function getAllZoneBoundaries(): readonly ZoneBoundary[] {
  return ZONE_BOUNDARIES;
}

export function tsbToAngle(tsb: number): number {
  const clamped = Math.min(25, Math.max(-40, tsb));
  const t = (clamped - -40) / (25 - -40);
  return Math.PI * (1 - t);
}
