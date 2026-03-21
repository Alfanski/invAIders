import type { FormSnapshot, FormZone } from '@/lib/domain/coaching-engine';

export interface DailyFormPoint extends FormSnapshot {
  date: string;
  trimp: number;
  hasActivity: boolean;
}

export interface WeeklyLoad {
  weekLabel: string;
  trimp: number;
}

export interface RecoveryState {
  hoursSinceLastActivity: number;
  lastActivityTrimp: number;
  recoveryPct: number;
  readyFor: readonly string[];
  notReadyFor: readonly string[];
}

export interface ZonePresentation {
  zone: FormZone;
  label: string;
  shortLabel: string;
  color: string;
  bgColor: string;
}
