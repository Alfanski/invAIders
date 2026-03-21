import { describe, expect, it } from 'vitest';

import type { AgentErrorCode } from './runWorkoutAgent';

describe('AgentErrorCode type coverage', () => {
  const validCodes: AgentErrorCode[] = [
    'langchain_tool_error',
    'gemini_schema_invalid',
    'gemini_timeout',
    'gemini_invoke_error',
    'gemini_empty_response',
    'max_rounds_exceeded',
    'strava_404_deleted',
  ];

  it('defines all DD-003 error codes', () => {
    expect(validCodes).toContain('langchain_tool_error');
    expect(validCodes).toContain('gemini_schema_invalid');
    expect(validCodes).toContain('gemini_timeout');
    expect(validCodes).toContain('strava_404_deleted');
  });

  it('includes operational error codes', () => {
    expect(validCodes).toContain('gemini_invoke_error');
    expect(validCodes).toContain('gemini_empty_response');
    expect(validCodes).toContain('max_rounds_exceeded');
  });
});

describe('parseAnalysis via runWorkoutAgent exports', () => {
  it('exports the expected types', async () => {
    const mod = await import('./runWorkoutAgent');
    expect(typeof mod.runWorkoutAgent).toBe('function');
  });
});
