import { describe, expect, it } from 'vitest';

import {
  computeActivityTrimp,
  computeTrimp,
  estimateTrimpWithoutHr,
  getDefaultMaxHr,
  getDefaultRestingHr,
} from './trimp';

describe('getDefaultRestingHr', () => {
  it('returns 60 for male', () => {
    expect(getDefaultRestingHr('M')).toBe(60);
  });

  it('returns 65 for female', () => {
    expect(getDefaultRestingHr('F')).toBe(65);
  });
});

describe('getDefaultMaxHr', () => {
  it('returns 190 for male', () => {
    expect(getDefaultMaxHr('M')).toBe(190);
  });

  it('returns 190 for female', () => {
    expect(getDefaultMaxHr('F')).toBe(190);
  });
});

describe('computeTrimp', () => {
  it('computes Banister TRIMP for a male runner', () => {
    const trimp = computeTrimp({
      durationMin: 45,
      avgHr: 150,
      restHr: 60,
      maxHr: 190,
      sex: 'M',
    });
    expect(trimp).toBeGreaterThan(0);
    expect(trimp).toBeLessThan(500);
  });

  it('computes Banister TRIMP for a female runner', () => {
    const trimp = computeTrimp({
      durationMin: 45,
      avgHr: 150,
      restHr: 65,
      maxHr: 190,
      sex: 'F',
    });
    expect(trimp).toBeGreaterThan(0);
    expect(trimp).toBeLessThan(500);
  });

  it('returns higher TRIMP for higher intensity', () => {
    const easy = computeTrimp({ durationMin: 60, avgHr: 120, restHr: 60, maxHr: 190, sex: 'M' });
    const hard = computeTrimp({ durationMin: 60, avgHr: 170, restHr: 60, maxHr: 190, sex: 'M' });
    expect(hard).toBeGreaterThan(easy);
  });

  it('returns higher TRIMP for longer duration', () => {
    const short = computeTrimp({ durationMin: 30, avgHr: 150, restHr: 60, maxHr: 190, sex: 'M' });
    const long = computeTrimp({ durationMin: 90, avgHr: 150, restHr: 60, maxHr: 190, sex: 'M' });
    expect(long).toBeGreaterThan(short);
  });

  it('returns 0 when maxHr equals restHr', () => {
    expect(computeTrimp({ durationMin: 45, avgHr: 60, restHr: 60, maxHr: 60, sex: 'M' })).toBe(0);
  });

  it('clamps HR ratio between 0 and 1', () => {
    const trimp = computeTrimp({
      durationMin: 45,
      avgHr: 200,
      restHr: 60,
      maxHr: 190,
      sex: 'M',
    });
    expect(trimp).toBeGreaterThan(0);
    expect(Number.isFinite(trimp)).toBe(true);
  });
});

describe('estimateTrimpWithoutHr', () => {
  it('estimates TRIMP based on duration and sport type', () => {
    const run = estimateTrimpWithoutHr({
      movingTimeSec: 3600,
      sportType: 'Run',
      distanceMeters: 10000,
      totalElevationGainM: 50,
    });
    expect(run).toBeGreaterThan(0);
  });

  it('returns higher TRIMP for higher-intensity sport types', () => {
    const walk = estimateTrimpWithoutHr({
      movingTimeSec: 3600,
      sportType: 'Walk',
      distanceMeters: 5000,
      totalElevationGainM: 0,
    });
    const trail = estimateTrimpWithoutHr({
      movingTimeSec: 3600,
      sportType: 'TrailRun',
      distanceMeters: 5000,
      totalElevationGainM: 0,
    });
    expect(trail).toBeGreaterThan(walk);
  });

  it('applies elevation bonus for hilly activities', () => {
    const flat = estimateTrimpWithoutHr({
      movingTimeSec: 3600,
      sportType: 'Run',
      distanceMeters: 10000,
      totalElevationGainM: 0,
    });
    const hilly = estimateTrimpWithoutHr({
      movingTimeSec: 3600,
      sportType: 'Run',
      distanceMeters: 10000,
      totalElevationGainM: 500,
    });
    expect(hilly).toBeGreaterThan(flat);
  });

  it('uses intensity factor 1.0 for unknown sport types', () => {
    const trimp = estimateTrimpWithoutHr({
      movingTimeSec: 3600,
      sportType: 'Curling',
      distanceMeters: 0,
      totalElevationGainM: 0,
    });
    expect(trimp).toBe(60);
  });
});

describe('computeActivityTrimp', () => {
  it('uses Banister formula when HR data is available', () => {
    const trimp = computeActivityTrimp(
      {
        movingTimeSec: 2700,
        averageHeartrate: 155,
        maxHeartrate: 175,
        sportType: 'Run',
        distanceMeters: 8000,
        totalElevationGainM: 30,
      },
      { sex: 'M', restingHr: 55, maxHr: 185 },
    );
    expect(trimp).toBeGreaterThan(0);
  });

  it('falls back to sufferScore when no HR data', () => {
    const trimp = computeActivityTrimp(
      {
        movingTimeSec: 2700,
        sportType: 'Run',
        distanceMeters: 8000,
        sufferScore: 87,
      },
      { sex: 'M' },
    );
    expect(trimp).toBe(87);
  });

  it('falls back to heuristic when no HR and no sufferScore', () => {
    const trimp = computeActivityTrimp(
      {
        movingTimeSec: 2700,
        sportType: 'Run',
        distanceMeters: 8000,
        totalElevationGainM: 100,
      },
      {},
    );
    expect(trimp).toBeGreaterThan(0);
  });

  it('uses default sex M when not provided', () => {
    const trimp = computeActivityTrimp(
      {
        movingTimeSec: 2700,
        averageHeartrate: 155,
        maxHeartrate: 175,
        sportType: 'Run',
        distanceMeters: 8000,
      },
      {},
    );
    expect(trimp).toBeGreaterThan(0);
  });
});
