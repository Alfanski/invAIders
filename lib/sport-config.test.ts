import { describe, expect, it } from 'vitest';

import { getSportConfig, toBucket } from './sport-config';
import type { ActivityBucket } from './sport-config';

describe('toBucket', () => {
  it.each([
    ['Run', 'run'],
    ['TrailRun', 'run'],
    ['VirtualRun', 'run'],
    ['Walk', 'run'],
    ['Hike', 'run'],
  ] as const)('maps %s to "run"', (sportType, expected) => {
    expect(toBucket(sportType)).toBe(expected);
  });

  it.each([
    ['Ride', 'ride'],
    ['EBikeRide', 'ride'],
    ['VirtualRide', 'ride'],
    ['MountainBikeRide', 'ride'],
    ['GravelRide', 'ride'],
  ] as const)('maps %s to "ride"', (sportType, expected) => {
    expect(toBucket(sportType)).toBe(expected);
  });

  it('maps Swim to "swim"', () => {
    expect(toBucket('Swim')).toBe('swim');
  });

  it.each(['Yoga', 'WeightTraining', 'Kayaking', 'Unknown'])('maps %s to "other"', (sportType) => {
    expect(toBucket(sportType)).toBe('other');
  });
});

describe('getSportConfig', () => {
  it('returns run config by default', () => {
    const cfg = getSportConfig('other');
    expect(cfg.speedLabel).toBe('Avg Pace');
    expect(cfg.speedUnit).toBe('/km');
    expect(cfg.invertSpeedAxis).toBe(true);
  });

  describe('run config', () => {
    const cfg = getSportConfig('run');

    it('has correct labels', () => {
      expect(cfg.speedLabel).toBe('Avg Pace');
      expect(cfg.cadenceLabel).toBe('Cadence');
      expect(cfg.cadenceUnit).toBe('spm');
      expect(cfg.splitLabel).toBe('KM');
    });

    it('shows elevation and splits, not power', () => {
      expect(cfg.showElevation).toBe(true);
      expect(cfg.showSplits).toBe(true);
      expect(cfg.showPower).toBe(false);
    });

    it('formats pace as min:sec /km', () => {
      expect(cfg.formatSpeed(300)).toBe('5:00 /km');
      expect(cfg.formatSpeed(297)).toBe('4:57 /km');
    });

    it('returns -- for zero pace', () => {
      expect(cfg.formatSpeed(0)).toBe('--');
    });
  });

  describe('ride config', () => {
    const cfg = getSportConfig('ride');

    it('has correct labels', () => {
      expect(cfg.speedLabel).toBe('Avg Speed');
      expect(cfg.speedUnit).toBe('km/h');
      expect(cfg.cadenceLabel).toBe('Cadence');
      expect(cfg.cadenceUnit).toBe('rpm');
    });

    it('shows power and elevation, not splits', () => {
      expect(cfg.showPower).toBe(true);
      expect(cfg.showElevation).toBe(true);
      expect(cfg.showSplits).toBe(false);
    });

    it('does not invert speed axis', () => {
      expect(cfg.invertSpeedAxis).toBe(false);
    });

    it('formats speed as km/h', () => {
      expect(cfg.formatSpeed(120)).toBe('30.0 km/h');
      expect(cfg.formatSpeed(90)).toBe('40.0 km/h');
    });

    it('returns -- for zero', () => {
      expect(cfg.formatSpeed(0)).toBe('--');
    });
  });

  describe('swim config', () => {
    const cfg = getSportConfig('swim');

    it('has correct labels', () => {
      expect(cfg.speedLabel).toBe('Avg Pace');
      expect(cfg.speedUnit).toBe('/100m');
      expect(cfg.cadenceLabel).toBe('Stroke Rate');
      expect(cfg.cadenceUnit).toBe('spm');
      expect(cfg.splitLabel).toBe('Lap');
    });

    it('hides elevation, shows splits, no power', () => {
      expect(cfg.showElevation).toBe(false);
      expect(cfg.showSplits).toBe(true);
      expect(cfg.showPower).toBe(false);
    });

    it('inverts speed axis (pace)', () => {
      expect(cfg.invertSpeedAxis).toBe(true);
    });

    it('formats pace as min:sec /100m', () => {
      expect(cfg.formatSpeed(600)).toBe('1:00 /100m');
      expect(cfg.formatSpeed(1000)).toBe('1:40 /100m');
    });

    it('returns -- for zero', () => {
      expect(cfg.formatSpeed(0)).toBe('--');
    });
  });

  it('returns a config for every bucket', () => {
    const buckets: ActivityBucket[] = ['run', 'ride', 'swim', 'other'];
    for (const b of buckets) {
      const cfg = getSportConfig(b);
      expect(cfg.speedLabel).toBeTruthy();
      expect(typeof cfg.formatSpeed).toBe('function');
      expect(typeof cfg.formatSpeedShort).toBe('function');
    }
  });
});
