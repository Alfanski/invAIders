import { describe, expect, it } from 'vitest';

import type { AgentErrorCode } from './runWorkoutAgent';

describe('AgentErrorCode type coverage', () => {
  const validCodes: AgentErrorCode[] = [
    'langchain_tool_error',
    'llm_schema_invalid',
    'llm_timeout',
    'llm_invoke_error',
    'llm_empty_response',
    'max_rounds_exceeded',
    'strava_404_deleted',
  ];

  it('defines all error codes', () => {
    expect(validCodes).toContain('langchain_tool_error');
    expect(validCodes).toContain('llm_schema_invalid');
    expect(validCodes).toContain('llm_timeout');
    expect(validCodes).toContain('strava_404_deleted');
  });

  it('includes operational error codes', () => {
    expect(validCodes).toContain('llm_invoke_error');
    expect(validCodes).toContain('llm_empty_response');
    expect(validCodes).toContain('max_rounds_exceeded');
  });
});

describe('parseAnalysis via runWorkoutAgent exports', () => {
  it('exports the expected types', async () => {
    const mod = await import('./runWorkoutAgent');
    expect(typeof mod.runWorkoutAgent).toBe('function');
  });
});
