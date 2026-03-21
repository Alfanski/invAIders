import { describe, expect, it } from 'vitest';

import { getAllWorkoutTools } from './workout-tools';

describe('getAllWorkoutTools', () => {
  const tools = getAllWorkoutTools();

  it('returns all 9 tools', () => {
    expect(tools).toHaveLength(9);
  });

  const expectedNames = [
    'getActivitySummary',
    'getDownsampledStreams',
    'getAthleteProfile',
    'getHeartRateZones',
    'getGearInfo',
    'getRecentActivities',
    'getFormSnapshot',
    'getExistingAnalysis',
    'getPreviousComparableActivity',
  ];

  it.each(expectedNames)('includes tool: %s', (name) => {
    const match = tools.find((t) => t.name === name);
    expect(match).toBeDefined();
  });

  it('every tool has a non-empty description', () => {
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.description.length).toBeGreaterThan(10);
    }
  });

  it('all tool names are unique', () => {
    const names = tools.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('core tools require activityId parameter', () => {
    const activityTools = ['getActivitySummary', 'getDownsampledStreams', 'getExistingAnalysis'];
    for (const name of activityTools) {
      const tool = tools.find((t) => t.name === name);
      expect(tool).toBeDefined();
      const schema = tool?.schema;
      expect(schema).toBeDefined();
    }
  });

  it('enrichment tools require athleteId parameter', () => {
    const athleteTools = ['getAthleteProfile', 'getHeartRateZones', 'getFormSnapshot'];
    for (const name of athleteTools) {
      const tool = tools.find((t) => t.name === name);
      expect(tool).toBeDefined();
    }
  });
});
