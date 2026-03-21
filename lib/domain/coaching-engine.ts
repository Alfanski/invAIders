export interface TrimpInput {
  durationMin: number;
  avgHr: number;
  restHr: number;
  maxHr: number;
  sex: 'M' | 'F';
}

export interface FormSnapshot {
  ctl: number;
  atl: number;
  tsb: number;
}

export type FormZone = 'overreaching' | 'fatigued' | 'balanced' | 'race_ready' | 'fresh';

export interface CoachingEngine {
  computeTrimp(input: TrimpInput): number;
  projectSeries(dailyTrimps: number[], priorCtl?: number, priorAtl?: number): FormSnapshot[];
  classifyForm(tsb: number): FormZone;
}
