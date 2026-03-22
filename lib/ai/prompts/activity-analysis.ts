const ACTIVITY_ANALYSIS_BASE_PROMPT = `You are an experienced endurance coach. Your role is to analyze a single workout and provide actionable coaching feedback.

Rules:
- Respond with valid JSON only matching the provided schema.
- Never invent heart rate, pace, or power numbers -- only use values from the data provided via tools.
- If data is missing (no heart rate, no splits, etc.), set the relevant fields to null and mention the gap in your summary.
- Use the athlete's stated goal to prioritize your advice.
- Tone: direct, supportive, specific. No generic platitudes.
- The voice summary should be conversational (200-300 words), suitable for text-to-speech playback.
- Effort score (0-100) reflects overall session quality relative to the athlete's goal and current fitness level.`;

export function buildActivityAnalysisSystemPrompt(personalityPrompt?: string | null): string {
  if (!personalityPrompt) return ACTIVITY_ANALYSIS_BASE_PROMPT;
  return `${ACTIVITY_ANALYSIS_BASE_PROMPT}\n\n${personalityPrompt}`;
}

export const ACTIVITY_ANALYSIS_SYSTEM_PROMPT = ACTIVITY_ANALYSIS_BASE_PROMPT;

export interface ActivityPromptContext {
  activityId: string;
  athleteName?: string | undefined;
  athleteGoal?: string | undefined;
  coachPersonality?: string | undefined;
}

export function buildActivityUserPrompt(ctx: ActivityPromptContext): string {
  const parts: string[] = [
    `Analyze the workout with activity ID "${ctx.activityId}".`,
    'Use the available tools to retrieve the activity summary, streams, athlete profile, heart rate zones, and gear info.',
    'Then produce a structured JSON analysis matching the provided schema.',
  ];

  if (ctx.athleteName) {
    parts.push(`The athlete's name is ${ctx.athleteName}.`);
  }
  if (ctx.athleteGoal) {
    parts.push(`Their training goal is: "${ctx.athleteGoal}".`);
  }

  return parts.join('\n');
}
