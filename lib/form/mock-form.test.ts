import { describe, expect, it } from 'vitest';

import { generateMockFormData } from '@/lib/mock-form';

describe('generateMockFormData', () => {
  const data = generateMockFormData();

  it('produces 56 days of series data (8 weeks)', () => {
    expect(data.series).toHaveLength(56);
  });

  it('each series point has required fields', () => {
    for (const point of data.series) {
      expect(point).toHaveProperty('date');
      expect(point).toHaveProperty('trimp');
      expect(point).toHaveProperty('hasActivity');
      expect(point).toHaveProperty('ctl');
      expect(point).toHaveProperty('atl');
      expect(point).toHaveProperty('tsb');
    }
  });

  it('current is the last series point', () => {
    const lastPoint = data.series[data.series.length - 1];
    expect(data.current.date).toBe(lastPoint?.date);
  });

  it('has 4 weekly load entries', () => {
    expect(data.weeklyLoads).toHaveLength(4);
  });

  it('weekly loads have positive TRIMP values', () => {
    for (const load of data.weeklyLoads) {
      expect(load.trimp).toBeGreaterThan(0);
    }
  });

  it('TSB equals CTL minus ATL for all points', () => {
    for (const point of data.series) {
      expect(point.tsb).toBeCloseTo(point.ctl - point.atl, 0);
    }
  });

  it('trend7d reflects change from 7 days ago', () => {
    expect(typeof data.trend7d.ctl).toBe('number');
    expect(typeof data.trend7d.atl).toBe('number');
    expect(typeof data.trend7d.tsb).toBe('number');
  });

  it('recovery state is populated', () => {
    expect(data.recovery.recoveryPct).toBeGreaterThanOrEqual(0);
    expect(data.recovery.recoveryPct).toBeLessThanOrEqual(100);
  });

  it('has non-empty AI text fields', () => {
    expect(data.aiAssessment.length).toBeGreaterThan(20);
    expect(data.todayRec.length).toBeGreaterThan(20);
  });
});
