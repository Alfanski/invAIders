import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import { action, internalAction } from './_generated/server';
import { generateJSON, generateText, LLMError } from './lib/llm';

const COACH_SYSTEM_PROMPT_BASE = `You are mAIcoach, an expert AI running and cycling coach.
You analyze workout data with the insight of an experienced coach, providing specific, actionable feedback.
Be encouraging but honest. Use data to support your observations.
Speak in first person as the coach. Keep language conversational but precise.
Use metric units (km, min/km pace, bpm, meters elevation).
Never fabricate data -- only reference numbers that appear in the provided context.`;

const PERSONALITY_PROMPTS: Record<string, string> = {
  motivator:
    'Coaching style: High-energy motivator. Celebrate achievements enthusiastically. Use encouraging, upbeat language. Hype up PRs and breakthroughs. Frame setbacks as exciting challenges. Push the athlete to believe in their potential.',
  analyst:
    'Coaching style: Analytical and data-driven. Lead with metrics, percentages, and trends. Compare current performance to historical baselines. Highlight statistical patterns. Use precise language. Favor quantified observations over subjective assessments.',
  zen: 'Coaching style: Calm and mindful. Emphasize balance, recovery, and sustainability over raw performance. Encourage listening to the body. Frame training as a journey. Use measured, thoughtful language. Value consistency over intensity.',
  'drill-sergeant':
    'Coaching style: Tough-love drill sergeant. Be blunt and direct. Call out laziness, missed targets, and poor pacing decisions without sugarcoating. Set high standards. Demand accountability. Use short, punchy sentences.',
  buddy:
    'Coaching style: Friendly training buddy. Use casual, conversational language. Share the excitement like a friend who just ran alongside them. Use humor and colloquialisms. Give advice the way a knowledgeable friend would over a post-run coffee.',
};

function buildCoachSystemPrompt(personality: string | undefined | null): string {
  if (!personality || !PERSONALITY_PROMPTS[personality]) return COACH_SYSTEM_PROMPT_BASE;
  return `${COACH_SYSTEM_PROMPT_BASE}\n\n${PERSONALITY_PROMPTS[personality]}`;
}

// -----------------------------------------------------------------------
// analyzeWorkout + buildWorkoutPrompt — SUPERSEDED by n8n pipeline
// Single-workout analysis is now handled entirely in the n8n workflow
// (see n8n/workflows/maicoachtest.json). These are kept for reference.
// -----------------------------------------------------------------------
//
// interface WorkoutAnalysis { ... }
// export const analyzeWorkout = internalAction({ ... });
// function buildWorkoutPrompt(...) { ... }
//

interface WeeklySummaryResult {
  executiveSummary: string;
  voiceSummary: string;
}

export const generateWeeklySummary = internalAction({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const activities = await ctx.runQuery(internal.activities.listAll, {
      athleteId: args.athleteId,
    });

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    const weekStartLocal = weekStart.toISOString().slice(0, 10);
    const weekEndLocal = weekEnd.toISOString().slice(0, 10);

    const weekActivities = activities.filter((a) => {
      const d = new Date(a.startDate);
      return d >= weekStart && d <= weekEnd;
    });

    if (weekActivities.length === 0) {
      console.log(`No activities this week for ${args.athleteId}, skipping summary`);
      return;
    }

    const athlete = await ctx.runQuery(internal.athletes.getById, {
      athleteId: args.athleteId,
    });

    const formSnapshot = await ctx.runQuery(api.formSnapshots.getLatestForAthlete, {
      athleteId: args.athleteId,
    });

    const existingAnalysis = await ctx.runQuery(internal.weeklyAnalyses.getForAthleteWeekInternal, {
      athleteId: args.athleteId,
      weekStartLocal,
    });

    const totalDist = weekActivities.reduce((s, a) => s + a.distanceMeters, 0);
    const totalTime = weekActivities.reduce((s, a) => s + a.movingTimeSec, 0);
    const totalElev = weekActivities.reduce((s, a) => s + (a.totalElevationGainM ?? 0), 0);
    const totalTrimp = weekActivities.reduce((s, a) => s + (a.trimp ?? 0), 0);

    const hasExisting = existingAnalysis?.executiveSummary;
    const taskInstruction = hasExisting
      ? 'Update the weekly training summary below, incorporating the latest activity data. Preserve insights from the previous summary that are still relevant, and weave in observations about the new session(s).'
      : 'Generate a weekly training summary.';

    const prompt = `${taskInstruction} Return JSON with:
- executiveSummary (3-5 sentences covering volume, intensity distribution, standout efforts, recovery balance)
- voiceSummary (1-2 sentence audio-friendly summary)

## Week: ${weekStartLocal} to ${weekEndLocal}
- Activities: ${String(weekActivities.length)}
- Total Distance: ${(totalDist / 1000).toFixed(1)} km
- Total Duration: ${String(Math.round(totalTime / 60))} min
- Total Elevation: ${String(Math.round(totalElev))} m
- Total TRIMP: ${String(Math.round(totalTrimp))}

## Activities This Week
${weekActivities
  .map((a) => {
    const km = (a.distanceMeters / 1000).toFixed(1);
    const min = Math.round(a.movingTimeSec / 60);
    return `- ${a.name}: ${a.sportType}, ${km}km, ${String(min)}min${a.averageHeartrate ? `, ${String(Math.round(a.averageHeartrate))}bpm avg` : ''}${a.trimp ? `, TRIMP ${String(Math.round(a.trimp))}` : ''}`;
  })
  .join('\n')}

${athlete?.goalText ? `## Athlete Goal\n${athlete.goalText}` : ''}
${formSnapshot ? `## Current Form\n- CTL: ${String(formSnapshot.ctl)}, ATL: ${String(formSnapshot.atl)}, TSB: ${String(formSnapshot.tsb)}${formSnapshot.acwr ? `, ACWR: ${String(formSnapshot.acwr)}` : ''}` : ''}
${hasExisting ? `## Previous Weekly Summary (refine and update with the new data)\n${String(existingAnalysis.executiveSummary)}` : ''}`;

    try {
      const result = await generateJSON<WeeklySummaryResult>(prompt, {
        systemPrompt: buildCoachSystemPrompt(athlete?.coachPersonality),
        temperature: 0.4,
        maxTokens: 1024,
      });

      await ctx.runMutation(internal.weeklyAnalyses.upsertForWeek, {
        athleteId: args.athleteId,
        weekStartLocal,
        weekEndLocal,
        aggregateStats: {
          activityCount: weekActivities.length,
          distanceMeters: totalDist,
          movingTimeSec: totalTime,
          elevationGainM: totalElev,
        },
        executiveSummary: result.executiveSummary,
        voiceSummary: result.voiceSummary,
      });

      console.log(`Generated weekly summary for ${args.athleteId}: ${weekStartLocal}`);
    } catch (err) {
      const msg = err instanceof LLMError ? err.message : String(err);
      console.error(`Weekly summary failed for ${args.athleteId}: ${msg}`);
    }
  },
});

interface DailyPlanResult {
  executiveSummary: string;
  recommendations: string[];
  voiceSummary: string;
}

export const generateDailyPlan = internalAction({
  args: { athleteId: v.id('athletes') },
  handler: async (ctx, args) => {
    const athlete = await ctx.runQuery(internal.athletes.getById, {
      athleteId: args.athleteId,
    });
    if (!athlete) return;

    const activities = await ctx.runQuery(internal.activities.listAll, {
      athleteId: args.athleteId,
    });

    const formSnapshot = await ctx.runQuery(api.formSnapshots.getLatestForAthlete, {
      athleteId: args.athleteId,
    });

    const recentActivities = activities.slice(0, 7);
    const lastActivity = recentActivities[0];

    const hoursSinceLast = lastActivity
      ? (Date.now() - new Date(lastActivity.startDate).getTime()) / (1000 * 60 * 60)
      : 999;

    const prompt = `Generate today's training plan. Return JSON with:
- executiveSummary (2-3 sentences about today's recommendation and why)
- recommendations (array of 3-5 specific actionable items)
- voiceSummary (1-2 sentence audio-friendly summary)

## Athlete
${athlete.firstName ? `- Name: ${athlete.firstName}` : ''}
${athlete.sex ? `- Sex: ${athlete.sex}` : ''}
${athlete.goalText ? `- Goal: ${athlete.goalText}` : ''}

## Current Form
${formSnapshot ? `- CTL (Fitness): ${String(formSnapshot.ctl)}\n- ATL (Fatigue): ${String(formSnapshot.atl)}\n- TSB (Form): ${String(formSnapshot.tsb)}${formSnapshot.acwr ? `\n- ACWR: ${String(formSnapshot.acwr)}` : ''}` : '- No form data available yet'}

## Recent Activities (last 7)
${
  recentActivities.length > 0
    ? recentActivities
        .map((a) => {
          const km = (a.distanceMeters / 1000).toFixed(1);
          const min = Math.round(a.movingTimeSec / 60);
          const daysAgo = Math.round(
            (Date.now() - new Date(a.startDate).getTime()) / (1000 * 60 * 60 * 24),
          );
          return `- ${String(daysAgo)}d ago: ${a.name} (${a.sportType}, ${km}km, ${String(min)}min${a.trimp ? `, TRIMP ${String(Math.round(a.trimp))}` : ''})`;
        })
        .join('\n')
    : '- No recent activities'
}

## Recovery
- Hours since last activity: ${String(Math.round(hoursSinceLast))}
${lastActivity?.trimp ? `- Last activity TRIMP: ${String(Math.round(lastActivity.trimp))}` : ''}`;

    try {
      const result = await generateJSON<DailyPlanResult>(prompt, {
        systemPrompt: buildCoachSystemPrompt(athlete.coachPersonality),
        temperature: 0.4,
        maxTokens: 1024,
      });

      const todayStr = new Date().toISOString().slice(0, 10);

      await ctx.runMutation(internal.formAssessments.upsertForDate, {
        athleteId: args.athleteId,
        generatedAt: todayStr,
        executiveSummary: result.executiveSummary,
        recommendations: result.recommendations,
        voiceSummary: result.voiceSummary,
      });

      console.log(`Generated daily plan for ${args.athleteId}`);
    } catch (err) {
      const msg = err instanceof LLMError ? err.message : String(err);
      console.error(`Daily plan failed for ${args.athleteId}: ${msg}`);
    }
  },
});

export const generateWeeklySummaryForAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const athletes = await ctx.runQuery(internal.athletes.listAllInternal, {});
    for (const athlete of athletes) {
      if (athlete.formBackfillStatus !== 'complete') continue;
      await ctx.scheduler.runAfter(0, internal.aiAnalysis.generateWeeklySummary, {
        athleteId: athlete._id,
      });
    }
    console.log(`[cron] Scheduled weekly summaries for ${String(athletes.length)} athletes`);
  },
});

export const generateDailyPlanForAll = internalAction({
  args: {},
  handler: async (ctx) => {
    const athletes = await ctx.runQuery(internal.athletes.listAllInternal, {});
    for (const athlete of athletes) {
      if (athlete.formBackfillStatus !== 'complete') continue;
      await ctx.scheduler.runAfter(0, internal.aiAnalysis.generateDailyPlan, {
        athleteId: athlete._id,
      });
    }
    console.log(`[cron] Scheduled daily plans for ${String(athletes.length)} athletes`);
  },
});

export const coachChat = action({
  args: {
    athleteId: v.id('athletes'),
    message: v.string(),
  },
  handler: async (ctx, args) => {
    const athlete = await ctx.runQuery(internal.athletes.getById, {
      athleteId: args.athleteId,
    });

    const activities = await ctx.runQuery(internal.activities.listAll, {
      athleteId: args.athleteId,
    });
    const recentActivities = activities.slice(0, 5);

    const formSnapshot = await ctx.runQuery(api.formSnapshots.getLatestForAthlete, {
      athleteId: args.athleteId,
    });

    let context = '## Athlete Context';
    if (athlete) {
      if (athlete.firstName) context += `\nName: ${athlete.firstName}`;
      if (athlete.sex) context += `\nSex: ${athlete.sex}`;
      if (athlete.goalText) context += `\nGoal: ${athlete.goalText}`;
    }

    if (formSnapshot) {
      context += `\n\n## Current Form`;
      context += `\nCTL (Fitness): ${String(formSnapshot.ctl)}`;
      context += `\nATL (Fatigue): ${String(formSnapshot.atl)}`;
      context += `\nTSB (Form): ${String(formSnapshot.tsb)}`;
      if (formSnapshot.acwr) context += `\nACWR: ${String(formSnapshot.acwr)}`;
    }

    if (recentActivities.length > 0) {
      context += `\n\n## Recent Activities`;
      for (const a of recentActivities) {
        const km = (a.distanceMeters / 1000).toFixed(1);
        const min = Math.round(a.movingTimeSec / 60);
        const daysAgo = Math.round(
          (Date.now() - new Date(a.startDate).getTime()) / (1000 * 60 * 60 * 24),
        );
        context += `\n- ${String(daysAgo)}d ago: ${a.name} (${a.sportType}, ${km}km, ${String(min)}min${a.trimp ? `, TRIMP ${String(Math.round(a.trimp))}` : ''})`;
      }
    }

    const prompt = `${context}\n\n## User Question\n${args.message}\n\nRespond as the coach in 2-5 sentences. Be specific and reference the data above when relevant.`;

    try {
      const response = await generateText(prompt, {
        systemPrompt: buildCoachSystemPrompt(athlete?.coachPersonality),
        temperature: 0.5,
        maxTokens: 512,
      });

      return { response, error: null };
    } catch (err) {
      const msg = err instanceof LLMError ? err.message : String(err);
      console.error(`Coach chat failed: ${msg}`);
      return {
        response:
          'I apologize, but I am having trouble processing your question right now. Could you try again in a moment?',
        error: msg,
      };
    }
  },
});
