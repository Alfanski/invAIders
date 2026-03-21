import { describe, expect, it } from 'vitest';

import { buildActivityUserPrompt } from './activity-analysis';

describe('buildActivityUserPrompt', () => {
  it('includes the activity ID', () => {
    const result = buildActivityUserPrompt({ activityId: 'abc123' });
    expect(result).toContain('abc123');
  });

  it('includes athlete name when provided', () => {
    const result = buildActivityUserPrompt({ activityId: 'abc123', athleteName: 'Lorenzo' });
    expect(result).toContain('Lorenzo');
  });

  it('includes goal when provided', () => {
    const result = buildActivityUserPrompt({
      activityId: 'abc123',
      athleteGoal: 'sub-3:30 marathon',
    });
    expect(result).toContain('sub-3:30 marathon');
  });

  it('works with no optional fields', () => {
    const result = buildActivityUserPrompt({ activityId: 'x' });
    expect(result).toContain('activity ID');
    expect(result).not.toContain('name is');
    expect(result).not.toContain('goal is');
  });
});
