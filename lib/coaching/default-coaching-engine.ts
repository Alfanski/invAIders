import type {
  CoachingEngine,
  FormSnapshot,
  FormZone,
  TrimpInput,
} from '@/lib/domain/coaching-engine';

const CTL_DECAY = 1 / 42;
const ATL_DECAY = 1 / 7;

export class DefaultCoachingEngine implements CoachingEngine {
  computeTrimp(input: TrimpInput): number {
    const hrRatio = (input.avgHr - input.restHr) / (input.maxHr - input.restHr);
    const b = input.sex === 'M' ? 1.92 : 1.67;
    return input.durationMin * hrRatio * Math.exp(b * hrRatio);
  }

  projectSeries(dailyTrimps: number[], priorCtl = 0, priorAtl = 0): FormSnapshot[] {
    let ctl = priorCtl;
    let atl = priorAtl;

    return dailyTrimps.map((trimp) => {
      ctl = ctl + CTL_DECAY * (trimp - ctl);
      atl = atl + ATL_DECAY * (trimp - atl);
      return { ctl, atl, tsb: ctl - atl };
    });
  }

  classifyForm(tsb: number): FormZone {
    if (tsb < -30) return 'overreaching';
    if (tsb < -10) return 'fatigued';
    if (tsb < 5) return 'balanced';
    if (tsb < 15) return 'race_ready';
    return 'fresh';
  }
}
