import { describe, expect, it } from 'vitest';

import {
  formatDuration,
  formatPace,
  formatSpeed,
  formatSwimPace,
  formatTemperature,
} from './units';

describe('formatDuration', () => {
  it('formats seconds-only durations', () => {
    expect(formatDuration(45)).toBe('0:45');
  });

  it('formats minutes and seconds', () => {
    expect(formatDuration(185)).toBe('3:05');
  });

  it('formats hours, minutes, and seconds', () => {
    expect(formatDuration(3661)).toBe('1:01:01');
  });

  it('handles zero', () => {
    expect(formatDuration(0)).toBe('0:00');
  });
});

describe('formatPace', () => {
  it('formats pace as min:sec /km', () => {
    expect(formatPace(297)).toBe('4:57 /km');
  });

  it('pads seconds to two digits', () => {
    expect(formatPace(305)).toBe('5:05 /km');
  });
});

describe('formatSpeed', () => {
  it('converts sec/km to km/h', () => {
    expect(formatSpeed(120)).toBe('30.0 km/h');
  });

  it('handles typical cycling speed', () => {
    expect(formatSpeed(90)).toBe('40.0 km/h');
  });

  it('returns placeholder for zero', () => {
    expect(formatSpeed(0)).toBe('-- km/h');
  });

  it('returns placeholder for negative', () => {
    expect(formatSpeed(-10)).toBe('-- km/h');
  });
});

describe('formatSwimPace', () => {
  it('converts sec/km to pace per 100m', () => {
    expect(formatSwimPace(600)).toBe('1:00 /100m');
  });

  it('formats with padded seconds', () => {
    expect(formatSwimPace(1050)).toBe('1:45 /100m');
  });

  it('returns placeholder for zero', () => {
    expect(formatSwimPace(0)).toBe('--:-- /100m');
  });
});

describe('formatTemperature', () => {
  it('rounds and appends unit', () => {
    expect(formatTemperature(9.4)).toBe('9 C');
  });

  it('handles negative temperatures', () => {
    expect(formatTemperature(-3.7)).toBe('-4 C');
  });
});
