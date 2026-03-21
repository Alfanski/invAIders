import { describe, expect, it } from 'vitest';

import { MetricUnitConverter } from './metric-unit-converter';

const converter = new MetricUnitConverter();

describe('MetricUnitConverter', () => {
  it('formats distance from meters to km', () => {
    expect(converter.formatDistance(10200)).toBe('10.2 km');
  });

  it('formats duration with hours', () => {
    expect(converter.formatDuration(3661)).toBe('1:01:01');
  });

  it('formats duration without hours', () => {
    expect(converter.formatDuration(185)).toBe('3:05');
  });

  it('formats pace in min:sec /km', () => {
    expect(converter.formatPace(297)).toBe('4:57 /km');
  });

  it('formats speed in km/h', () => {
    expect(converter.formatSpeed(2.78)).toBe('10.0 km/h');
  });

  it('formats temperature in Celsius', () => {
    expect(converter.formatTemperature(9.4)).toBe('9 C');
  });

  it('formats elevation in meters', () => {
    expect(converter.formatElevation(84.3)).toBe('84 m');
  });
});
