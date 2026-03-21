import { describe, expect, it } from 'vitest';

import { formatDuration, formatPace, formatTemperature } from './units';

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

describe('formatTemperature', () => {
  it('rounds and appends unit', () => {
    expect(formatTemperature(9.4)).toBe('9 C');
  });

  it('handles negative temperatures', () => {
    expect(formatTemperature(-3.7)).toBe('-4 C');
  });
});
