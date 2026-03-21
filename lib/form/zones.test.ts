import { describe, expect, it } from 'vitest';

import { getAllZoneBoundaries, getZoneBoundary, tsbToAngle } from './zones';

describe('zones', () => {
  describe('getZoneBoundary', () => {
    it('returns boundary for each valid zone', () => {
      expect(getZoneBoundary('overreaching').zone).toBe('overreaching');
      expect(getZoneBoundary('fatigued').zone).toBe('fatigued');
      expect(getZoneBoundary('balanced').zone).toBe('balanced');
      expect(getZoneBoundary('race_ready').zone).toBe('race_ready');
      expect(getZoneBoundary('fresh').zone).toBe('fresh');
    });

    it('includes label and short label', () => {
      const boundary = getZoneBoundary('race_ready');
      expect(boundary.label).toContain('Race Ready');
      expect(boundary.shortLabel).toBe('Race Ready');
    });

    it('has correct min/max for balanced zone', () => {
      const balanced = getZoneBoundary('balanced');
      expect(balanced.min).toBe(-10);
      expect(balanced.max).toBe(5);
    });
  });

  describe('getAllZoneBoundaries', () => {
    it('returns all 5 zones', () => {
      expect(getAllZoneBoundaries()).toHaveLength(5);
    });

    it('zones are contiguous (no gaps)', () => {
      const boundaries = getAllZoneBoundaries();
      for (let i = 1; i < boundaries.length; i++) {
        const prev = boundaries[i - 1];
        const curr = boundaries[i];
        if (prev && curr) {
          expect(curr.min).toBe(prev.max);
        }
      }
    });
  });

  describe('tsbToAngle', () => {
    it('returns PI for minimum TSB (-40)', () => {
      expect(tsbToAngle(-40)).toBeCloseTo(Math.PI, 10);
    });

    it('returns 0 for maximum TSB (25)', () => {
      expect(tsbToAngle(25)).toBeCloseTo(0, 10);
    });

    it('returns PI/2 for midpoint TSB (-7.5)', () => {
      expect(tsbToAngle(-7.5)).toBeCloseTo(Math.PI / 2, 10);
    });

    it('clamps values below -40', () => {
      expect(tsbToAngle(-100)).toBeCloseTo(tsbToAngle(-40), 10);
    });

    it('clamps values above 25', () => {
      expect(tsbToAngle(100)).toBeCloseTo(tsbToAngle(25), 10);
    });

    it('returns angle between 0 and PI for any valid TSB', () => {
      const angle = tsbToAngle(0);
      expect(angle).toBeGreaterThanOrEqual(0);
      expect(angle).toBeLessThanOrEqual(Math.PI);
    });
  });
});
