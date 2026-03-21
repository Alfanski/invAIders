import { describe, expect, it } from 'vitest';

import { buildDailyTrimps, classifyForm, projectFormSeries } from './formMetrics';

describe('projectFormSeries', () => {
  it('computes CTL/ATL/TSB/ACWR for a single day', () => {
    const series = projectFormSeries([{ date: '2026-03-20', trimp: 100 }]);
    expect(series).toHaveLength(1);
    const snap = series[0];
    expect(snap).toBeDefined();
    expect(snap?.ctl).toBeGreaterThan(0);
    expect(snap?.atl).toBeGreaterThan(0);
    expect(snap?.acwr).toBeGreaterThan(0);
    expect(snap?.date).toBe('2026-03-20');
  });

  it('CTL grows slower than ATL for a constant load', () => {
    const days = Array.from({ length: 14 }, (_, i) => ({
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      trimp: 80,
    }));
    const series = projectFormSeries(days);
    const last = series[series.length - 1];
    expect(last).toBeDefined();
    expect(last?.atl).toBeGreaterThan(last?.ctl ?? 0);
  });

  it('TSB is CTL minus ATL', () => {
    const series = projectFormSeries([
      { date: '2026-03-01', trimp: 100 },
      { date: '2026-03-02', trimp: 50 },
    ]);
    for (const snap of series) {
      expect(snap.tsb).toBeCloseTo(snap.ctl - snap.atl, 0);
    }
  });

  it('respects prior CTL/ATL', () => {
    const withPrior = projectFormSeries([{ date: '2026-03-20', trimp: 0 }], 50, 30);
    const withoutPrior = projectFormSeries([{ date: '2026-03-20', trimp: 0 }]);
    expect(withPrior[0]?.ctl).toBeGreaterThan(withoutPrior[0]?.ctl ?? 0);
  });
});

describe('classifyForm', () => {
  it('classifies overreaching for very negative TSB', () => {
    expect(classifyForm(-35)).toBe('overreaching');
  });

  it('classifies fatigued for moderately negative TSB', () => {
    expect(classifyForm(-20)).toBe('fatigued');
  });

  it('classifies balanced for near-zero TSB', () => {
    expect(classifyForm(0)).toBe('balanced');
  });

  it('classifies race_ready for moderately positive TSB', () => {
    expect(classifyForm(10)).toBe('race_ready');
  });

  it('classifies fresh for high positive TSB', () => {
    expect(classifyForm(20)).toBe('fresh');
  });
});

describe('buildDailyTrimps', () => {
  it('builds daily trimp map with gap filling', () => {
    const activities = [
      { startDate: '2026-03-18T08:00:00Z', trimp: 80, movingTimeSec: 3600 },
      { startDate: '2026-03-20T09:00:00Z', trimp: 100, movingTimeSec: 2700 },
    ];
    const daily = buildDailyTrimps(activities);
    expect(daily.length).toBeGreaterThanOrEqual(3);

    const march18 = daily.find((d) => d.date === '2026-03-18');
    expect(march18?.trimp).toBe(80);

    const march19 = daily.find((d) => d.date === '2026-03-19');
    expect(march19?.trimp).toBe(0);

    const march20 = daily.find((d) => d.date === '2026-03-20');
    expect(march20?.trimp).toBe(100);
  });

  it('sums TRIMP for multiple activities on the same day', () => {
    const activities = [
      { startDate: '2026-03-20T08:00:00Z', trimp: 50, movingTimeSec: 1800 },
      { startDate: '2026-03-20T17:00:00Z', trimp: 30, movingTimeSec: 1200 },
    ];
    const daily = buildDailyTrimps(activities);
    const march20 = daily.find((d) => d.date === '2026-03-20');
    expect(march20?.trimp).toBe(80);
  });

  it('returns empty array for no activities', () => {
    expect(buildDailyTrimps([])).toEqual([]);
  });

  it('falls back to duration estimate when trimp is undefined', () => {
    const activities = [{ startDate: '2026-03-20T08:00:00Z', movingTimeSec: 3600 }];
    const daily = buildDailyTrimps(
      activities as { startDate: string; trimp?: number; movingTimeSec: number }[],
    );
    const march20 = daily.find((d) => d.date === '2026-03-20');
    expect(march20?.trimp).toBe(72);
  });
});
