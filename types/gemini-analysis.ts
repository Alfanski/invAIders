import { z } from 'zod';

const zoneAnalysisSchema = z.object({
  zone: z.number().min(1).max(5),
  percentTime: z.number().min(0).max(100),
  comment: z.string(),
});

export const workoutAnalysisSchema = z.object({
  effortScore: z.number().min(0).max(100),
  executiveSummary: z.string(),
  positives: z.array(z.string()).min(1).max(5),
  improvements: z.array(z.string()).min(1).max(5),
  hrZoneAnalysis: z.array(zoneAnalysisSchema).optional(),
  splitAnalysis: z
    .object({
      trend: z.string(),
      comment: z.string(),
    })
    .optional(),
  nextSession: z
    .object({
      type: z.string(),
      durationMin: z.number(),
      intensity: z.string(),
      description: z.string(),
    })
    .optional(),
  weatherNote: z.string().optional(),
  voiceSummary: z.string().optional(),
});

export type WorkoutAnalysis = z.infer<typeof workoutAnalysisSchema>;
