import { describe, expect, it } from 'vitest';

import { getRouteContext, getSuggestionsForRoute } from './context-suggestions';

describe('getSuggestionsForRoute', () => {
  it('returns workout suggestions for /dashboard', () => {
    const suggestions = getSuggestionsForRoute('/dashboard');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.text.toLowerCase().includes('split'))).toBe(true);
  });

  it('returns week suggestions for /dashboard/week', () => {
    const suggestions = getSuggestionsForRoute('/dashboard/week');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.text.toLowerCase().includes('week'))).toBe(true);
  });

  it('returns form suggestions for /dashboard/form', () => {
    const suggestions = getSuggestionsForRoute('/dashboard/form');
    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.some((s) => s.text.toLowerCase().includes('today'))).toBe(true);
  });

  it('returns default suggestions for unknown routes', () => {
    const suggestions = getSuggestionsForRoute('/unknown');
    expect(suggestions.length).toBeGreaterThan(0);
  });

  it('each suggestion has text and prompt', () => {
    const suggestions = getSuggestionsForRoute('/dashboard');
    for (const s of suggestions) {
      expect(s.text.length).toBeGreaterThan(0);
      expect(s.prompt.length).toBeGreaterThan(0);
    }
  });
});

describe('getRouteContext', () => {
  it('returns workout context for /dashboard', () => {
    expect(getRouteContext('/dashboard')).toContain('workout');
  });

  it('returns week context for /dashboard/week', () => {
    expect(getRouteContext('/dashboard/week')).toContain('weekly');
  });

  it('returns form context for /dashboard/form', () => {
    expect(getRouteContext('/dashboard/form')).toContain('training pulse');
  });

  it('returns dashboard fallback for unknown routes', () => {
    expect(getRouteContext('/other')).toContain('dashboard');
  });
});
