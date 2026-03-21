import { describe, expect, it } from 'vitest';

import { computeRecovery } from './recovery';

describe('computeRecovery', () => {
  it('returns 100% recovery when fully recovered from easy session', () => {
    const result = computeRecovery(24, 30);
    expect(result.recoveryPct).toBe(100);
  });

  it('returns partial recovery shortly after a hard session', () => {
    const result = computeRecovery(12, 150);
    expect(result.recoveryPct).toBeGreaterThan(0);
    expect(result.recoveryPct).toBeLessThan(100);
  });

  it('maps easy activities to the shortest recovery band', () => {
    const fullyRecovered = computeRecovery(18, 40);
    expect(fullyRecovered.recoveryPct).toBe(100);
  });

  it('maps very hard activities to the longest recovery band', () => {
    const notRecovered = computeRecovery(24, 250);
    expect(notRecovered.recoveryPct).toBeLessThan(100);
  });

  it('includes correct activity metadata', () => {
    const result = computeRecovery(14, 142);
    expect(result.hoursSinceLastActivity).toBe(14);
    expect(result.lastActivityTrimp).toBe(142);
  });

  it('populates readyFor with achievable activities', () => {
    const result = computeRecovery(48, 80);
    expect(result.readyFor.length).toBeGreaterThan(0);
    expect(result.readyFor).toContain('Easy run');
  });

  it('populates notReadyFor when not fully recovered', () => {
    const result = computeRecovery(6, 150);
    expect(result.notReadyFor.length).toBeGreaterThan(0);
    expect(result.notReadyFor).toContain('Race effort');
  });

  it('marks all activities as ready when fully recovered', () => {
    const result = computeRecovery(72, 100);
    expect(result.readyFor).toHaveLength(5);
    expect(result.notReadyFor).toHaveLength(0);
  });

  it('caps recovery at 100%', () => {
    const result = computeRecovery(200, 30);
    expect(result.recoveryPct).toBe(100);
  });

  it('works without form signals (backward compatible)', () => {
    const result = computeRecovery(24, 80);
    expect(result.recoveryPct).toBeGreaterThan(0);
  });

  it('negative TSB reduces recovery percentage', () => {
    const base = computeRecovery(20, 100);
    const fatigued = computeRecovery(20, 100, { tsb: -25 });
    expect(fatigued.recoveryPct).toBeLessThan(base.recoveryPct);
  });

  it('positive TSB boosts recovery percentage', () => {
    const base = computeRecovery(20, 100);
    const fresh = computeRecovery(20, 100, { tsb: 15 });
    expect(fresh.recoveryPct).toBeGreaterThanOrEqual(base.recoveryPct);
  });

  it('high ACWR penalizes recovery', () => {
    const base = computeRecovery(20, 100);
    const spiked = computeRecovery(20, 100, { acwr: 1.8 });
    expect(spiked.recoveryPct).toBeLessThan(base.recoveryPct);
  });

  it('sweet-spot ACWR gives a small bonus', () => {
    const base = computeRecovery(20, 100);
    const sweetSpot = computeRecovery(20, 100, { acwr: 1.0 });
    expect(sweetSpot.recoveryPct).toBeGreaterThanOrEqual(base.recoveryPct);
  });
});
