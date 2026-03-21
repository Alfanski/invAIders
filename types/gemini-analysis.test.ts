import { describe, expect, it } from 'vitest';

import { workoutAnalysisSchema } from './gemini-analysis';

describe('workoutAnalysisSchema', () => {
  const validMinimal = {
    effortScore: 72,
    executiveSummary: 'Solid tempo run with good pacing.',
    positives: ['Even splits throughout'],
    improvements: ['Cadence dropped in final km'],
  };

  it('accepts a minimal valid payload', () => {
    const result = workoutAnalysisSchema.safeParse(validMinimal);
    expect(result.success).toBe(true);
  });

  it('accepts a full payload with all optional fields', () => {
    const full = {
      ...validMinimal,
      hrZoneAnalysis: [
        { zone: 1, percentTime: 5, comment: 'Warm-up' },
        { zone: 3, percentTime: 60, comment: 'Tempo effort' },
      ],
      splitAnalysis: { trend: 'negative', comment: 'Slowed in second half' },
      nextSession: {
        type: 'easy run',
        durationMin: 40,
        intensity: 'low',
        description: 'Recovery jog at conversational pace',
      },
      weatherNote: 'Hot and humid -- well managed',
      voiceSummary: 'Great run today. You held a solid tempo...',
    };
    const result = workoutAnalysisSchema.safeParse(full);
    expect(result.success).toBe(true);
  });

  it('rejects effortScore above 100', () => {
    const result = workoutAnalysisSchema.safeParse({ ...validMinimal, effortScore: 120 });
    expect(result.success).toBe(false);
  });

  it('rejects empty positives array', () => {
    const result = workoutAnalysisSchema.safeParse({ ...validMinimal, positives: [] });
    expect(result.success).toBe(false);
  });

  it('rejects missing executiveSummary', () => {
    const { executiveSummary: _es, ...rest } = validMinimal;
    const result = workoutAnalysisSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });
});
