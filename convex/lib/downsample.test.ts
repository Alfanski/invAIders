import { describe, expect, it } from 'vitest';

import type { StravaStream, StravaStreamSet } from './stravaApi';

import { downsampleStreams } from './downsample';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeStream<T>(data: T[]): StravaStream<T> {
  return { type: '', data, series_type: '', original_size: data.length, resolution: 'high' };
}

function timeStream(seconds: number[]): StravaStream<number> {
  return { ...makeStream(seconds), series_type: 'time' };
}

// ---------------------------------------------------------------------------
// Null / empty cases
// ---------------------------------------------------------------------------

describe('downsampleStreams', () => {
  it('returns null when time stream is missing', () => {
    expect(downsampleStreams({})).toBeNull();
  });

  it('returns null when time data is empty', () => {
    const streams: StravaStreamSet = { time: { ...makeStream<number>([]), series_type: 'time' } };
    expect(downsampleStreams(streams)).toBeNull();
  });

  // ---------------------------------------------------------------------------
  // Window size calculation
  // ---------------------------------------------------------------------------

  describe('window size', () => {
    it('uses minimum 30s window for short activities', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20, 30, 40, 50, 60]),
      };
      const result = downsampleStreams(streams);
      expect(result).not.toBeNull();
      expect(result?.meta.windowSec).toBe(30);
    });

    it('scales window for long activities to keep ~500 points', () => {
      const times = Array.from({ length: 3600 }, (_, i) => i);
      const streams: StravaStreamSet = { time: timeStream(times) };
      const result = downsampleStreams(streams);
      expect(result).not.toBeNull();
      // 3599s duration -> ceil(3599/500) = 8, max(30,8) = 30
      expect(result?.meta.windowSec).toBe(30);
    });

    it('uses larger window when duration exceeds 15000s', () => {
      const duration = 18000; // 5 hours
      const times = Array.from({ length: duration + 1 }, (_, i) => i);
      const streams: StravaStreamSet = { time: timeStream(times) };
      const result = downsampleStreams(streams);
      expect(result).not.toBeNull();
      // ceil(18000/500) = 36 > 30
      expect(result?.meta.windowSec).toBe(36);
    });
  });

  // ---------------------------------------------------------------------------
  // Time stream output
  // ---------------------------------------------------------------------------

  describe('time output', () => {
    it('produces correct window start times', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20, 30, 40, 50, 60, 70, 80, 90]),
      };
      const result = downsampleStreams(streams);
      expect(result?.timeSec[0]).toBe(0);
      // With 30s window: first window [0,30), second window [30,60), third window [60,90)
      expect(result?.timeSec[1]).toBe(30);
      expect(result?.timeSec[2]).toBe(60);
    });

    it('reports pointCount matching timeSec length', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 15, 30, 45, 60]),
      };
      const result = downsampleStreams(streams);
      expect(result?.meta.pointCount).toBe(result?.timeSec.length);
    });
  });

  // ---------------------------------------------------------------------------
  // Heartrate averaging
  // ---------------------------------------------------------------------------

  describe('heartrate', () => {
    it('averages heartrate values within each window', () => {
      // 30s window, points at 0,10,20,30
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20, 30]),
        heartrate: makeStream([140, 150, 160, 170]),
      };
      const result = downsampleStreams(streams);
      expect(result?.heartrateBpm).toBeDefined();
      // Window 1: [0,30) -> avg(140,150,160) = 150
      expect(result?.heartrateBpm?.[0]).toBe(150);
      // Window 2: [30,60) -> 170 alone
      expect(result?.heartrateBpm?.[1]).toBe(170);
    });

    it('omits heartrateBpm when heartrate stream is absent', () => {
      const streams: StravaStreamSet = { time: timeStream([0, 30, 60]) };
      const result = downsampleStreams(streams);
      expect(result?.heartrateBpm).toBeUndefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Distance (last value in window)
  // ---------------------------------------------------------------------------

  describe('distance', () => {
    it('takes the last distance value in each window', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20, 30]),
        distance: makeStream([0, 100, 200, 300]),
      };
      const result = downsampleStreams(streams);
      // Window 1: [0,30) -> last is index 2 -> 200
      expect(result?.distanceM?.[0]).toBe(200);
      // Window 2: [30,60) -> 300
      expect(result?.distanceM?.[1]).toBe(300);
    });
  });

  // ---------------------------------------------------------------------------
  // Latlng (last point in window)
  // ---------------------------------------------------------------------------

  describe('latlng', () => {
    it('takes the last latlng point in each window', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20, 30]),
        latlng: makeStream<[number, number]>([
          [40.0, -74.0],
          [40.1, -74.1],
          [40.2, -74.2],
          [40.3, -74.3],
        ]),
      };
      const result = downsampleStreams(streams);
      expect(result?.latlng?.[0]).toEqual([40.2, -74.2]);
      expect(result?.latlng?.[1]).toEqual([40.3, -74.3]);
    });
  });

  // ---------------------------------------------------------------------------
  // Altitude (averaged)
  // ---------------------------------------------------------------------------

  describe('altitude', () => {
    it('averages altitude in each window', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20, 30]),
        altitude: makeStream([100, 110, 120, 130]),
      };
      const result = downsampleStreams(streams);
      // Window 1: avg(100, 110, 120) = 110
      expect(result?.altitudeM?.[0]).toBe(110);
    });
  });

  // ---------------------------------------------------------------------------
  // Multiple stream types together
  // ---------------------------------------------------------------------------

  describe('combined streams', () => {
    it('handles all stream types simultaneously', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 15, 30]),
        heartrate: makeStream([140, 150, 160]),
        distance: makeStream([0, 500, 1000]),
        altitude: makeStream([100, 105, 110]),
        cadence: makeStream([170, 175, 180]),
        watts: makeStream([200, 250, 300]),
        velocity_smooth: makeStream([3.0, 3.5, 4.0]),
        temp: makeStream([18, 19, 20]),
        grade_smooth: makeStream([2.0, 3.0, 4.0]),
        latlng: makeStream<[number, number]>([
          [40.0, -74.0],
          [40.1, -74.1],
          [40.2, -74.2],
        ]),
      };

      const result = downsampleStreams(streams);
      expect(result).not.toBeNull();

      expect(result?.heartrateBpm).toBeDefined();
      expect(result?.distanceM).toBeDefined();
      expect(result?.altitudeM).toBeDefined();
      expect(result?.cadenceRpm).toBeDefined();
      expect(result?.watts).toBeDefined();
      expect(result?.velocitySmooth).toBeDefined();
      expect(result?.tempC).toBeDefined();
      expect(result?.gradeSmooth).toBeDefined();
      expect(result?.latlng).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // Edge cases
  // ---------------------------------------------------------------------------

  describe('edge cases', () => {
    it('handles a single data point', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0]),
        heartrate: makeStream([150]),
      };
      const result = downsampleStreams(streams);
      expect(result?.timeSec).toEqual([0]);
      expect(result?.heartrateBpm).toEqual([150]);
      expect(result?.meta.pointCount).toBe(1);
    });

    it('reduces 1000 points to roughly 500/duration-based count', () => {
      const times = Array.from({ length: 1000 }, (_, i) => i);
      const hr = Array.from({ length: 1000 }, () => 150);
      const streams: StravaStreamSet = {
        time: timeStream(times),
        heartrate: makeStream(hr),
      };
      const result = downsampleStreams(streams);
      expect(result).not.toBeNull();
      // 999s duration -> window = max(30, ceil(999/500)) = 30
      // Approx 999/30 ~= 34 windows
      expect(result?.meta.pointCount).toBeLessThan(100);
      expect(result?.meta.pointCount).toBeGreaterThan(10);
    });

    it('rounds numeric averages to 2 decimal places', () => {
      const streams: StravaStreamSet = {
        time: timeStream([0, 10, 20]),
        velocity_smooth: makeStream([3.333, 3.666, 3.999]),
      };
      const result = downsampleStreams(streams);
      const val = result?.velocitySmooth?.[0];
      expect(val).toBeDefined();
      if (val !== undefined) {
        const decimalPlaces = val.toString().split('.')[1]?.length ?? 0;
        expect(decimalPlaces).toBeLessThanOrEqual(2);
      }
    });
  });
});
