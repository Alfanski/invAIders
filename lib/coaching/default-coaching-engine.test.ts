import { describe, expect, it } from 'vitest';

import { DefaultCoachingEngine } from './default-coaching-engine';

const engine = new DefaultCoachingEngine();

describe('DefaultCoachingEngine', () => {
  describe('computeTrimp', () => {
    it('computes TRIMP for a moderate male run', () => {
      const trimp = engine.computeTrimp({
        durationMin: 50,
        avgHr: 150,
        restHr: 50,
        maxHr: 190,
        sex: 'M',
      });
      expect(trimp).toBeGreaterThan(50);
      expect(trimp).toBeLessThan(200);
    });

    it('returns higher TRIMP for longer duration at same intensity', () => {
      const base = { avgHr: 155, restHr: 50, maxHr: 190, sex: 'M' as const };
      const short = engine.computeTrimp({ ...base, durationMin: 30 });
      const long = engine.computeTrimp({ ...base, durationMin: 60 });
      expect(long).toBeGreaterThan(short);
    });

    it('uses different coefficient for female athletes', () => {
      const input = { durationMin: 50, avgHr: 150, restHr: 50, maxHr: 190 };
      const male = engine.computeTrimp({ ...input, sex: 'M' as const });
      const female = engine.computeTrimp({ ...input, sex: 'F' as const });
      expect(male).not.toBe(female);
    });
  });

  describe('projectSeries', () => {
    it('produces one snapshot per day', () => {
      const dailyTrimps = [100, 0, 50, 0, 80, 0, 0];
      const series = engine.projectSeries(dailyTrimps);
      expect(series).toHaveLength(7);
    });

    it('increases CTL after training load', () => {
      const series = engine.projectSeries([100, 100, 100, 100, 100]);
      const last = series.at(-1);
      expect(last).toBeDefined();
      expect(last?.ctl).toBeGreaterThan(0);
    });

    it('TSB equals CTL minus ATL', () => {
      const series = engine.projectSeries([80, 0, 60]);
      for (const snap of series) {
        expect(snap.tsb).toBeCloseTo(snap.ctl - snap.atl, 10);
      }
    });
  });

  describe('classifyForm', () => {
    it('classifies overreaching below -30', () => {
      expect(engine.classifyForm(-35)).toBe('overreaching');
    });

    it('classifies fatigued between -30 and -10', () => {
      expect(engine.classifyForm(-20)).toBe('fatigued');
    });

    it('classifies balanced between -10 and 5', () => {
      expect(engine.classifyForm(0)).toBe('balanced');
    });

    it('classifies race ready between 5 and 15', () => {
      expect(engine.classifyForm(10)).toBe('race_ready');
    });

    it('classifies fresh above 15', () => {
      expect(engine.classifyForm(20)).toBe('fresh');
    });
  });
});
