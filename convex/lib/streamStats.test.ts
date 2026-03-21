import { describe, expect, it } from 'vitest';

import { computeStreamStats } from './streamStats';

describe('computeStreamStats', () => {
  it('computes min/avg/max for heart rate stream', () => {
    const stats = computeStreamStats({
      heartrateBpm: [120, 140, 160, 150, 130],
    });
    expect(stats.heartrateBpm).toEqual({ min: 120, avg: 140, max: 160 });
  });

  it('computes stats for multiple streams', () => {
    const stats = computeStreamStats({
      heartrateBpm: [100, 150, 200],
      altitudeM: [50, 100, 75],
      cadenceRpm: [80, 90, 85],
    });
    expect(stats.heartrateBpm).toEqual({ min: 100, avg: 150, max: 200 });
    expect(stats.altitudeM).toEqual({ min: 50, avg: 75, max: 100 });
    expect(stats.cadenceRpm).toEqual({ min: 80, avg: 85, max: 90 });
  });

  it('returns empty object when no streams provided', () => {
    expect(computeStreamStats({})).toEqual({});
  });

  it('skips missing streams', () => {
    const stats = computeStreamStats({
      heartrateBpm: [120, 130],
    });
    expect(stats.heartrateBpm).toBeDefined();
    expect(stats.velocitySmooth).toBeUndefined();
  });

  it('returns empty stats for empty arrays', () => {
    const stats = computeStreamStats({
      heartrateBpm: [],
    });
    expect(stats.heartrateBpm).toBeUndefined();
  });

  it('rounds to 2 decimal places', () => {
    const stats = computeStreamStats({
      velocitySmooth: [3.333, 3.666, 4.0],
    });
    expect(stats.velocitySmooth?.avg).toBe(3.67);
    expect(stats.velocitySmooth?.min).toBe(3.33);
  });
});
