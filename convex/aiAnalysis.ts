import { v } from 'convex/values';

import { api, internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { action, internalAction } from './_generated/server';
import { generateJSON, generateText, GeminiError } from './lib/gemini';

const COACH_SYSTEM_PROMPT = `You are mAIcoach, an expert AI running and cycling coach.
You analyze workout data with the insight of an experienced coach, providing specific, actionable feedback.
Be encouraging but honest. Use data to support your observations.
Speak in first person as the coach. Keep language conversational but precise.
Use metric units (km, min/km pace, bpm, meters elevation).
Never fabricate data -- only reference numbers that appear in the provided context.`;

interface WorkoutAnalysis {
  effortScore: number;
  executiveSummary: string;
  positives: string[];
  improvements: string[];
  splitAnalysis?: { trend: string; comment: string };
  nextSession?: {
    type: string;
    durationMin: number;
    intensity: string;
    description: string;
  };
  voiceSummary: string;
}

export const analyzeWorkout = internalAction({
  args: { activityId: v.id('activities') },
  handler: async (ctx, args) => {
    const activity = await ctx.runQuery(internal.activities.getByDocId, {
      activityId: args.activityId,
    });
    if (!activity) {
      console.warn(`Activity ${args.activityId} not found for analysis`);
      return;
    }

    const existingAnalysis = await ctx.runQuery(api.analyses.getForActivity, {
      activityId: args.activityId,
    });
    if (existingAnalysis) return;

    const streams = await ctx.runQuery(api.activityStreams.getDownsampledForActivity, {
      activityId: args.activityId,
    });

    const athlete = await ctx.runQuery(internal.athletes.getById, {
      athleteId: activity.athleteId,
    });

    const formSnapshot = await ctx.runQuery(api.formSnapshots.getLatestForAthlete, {
      athleteId: activity.athleteId,
    });

    const prompt = buildWorkoutPrompt(activity, streams ?? null, athlete ?? null, formSnapshot);

    try {
      const analysis = await generateJSON<WorkoutAnalysis>(prompt, {
        systemPrompt: COACH_SYSTEM_PROMPT,
        temperature: 0.4,
        maxTokens: 2048,
      });

      await ctx.runMutation(internal.analyses.upsertForActivity, {
        activityId: args.activityId,
        model: 'gemini-2.0-flash',
        effortScore: analysis.effortScore,
        executiveSummary: analysis.executiveSummary,
        positives: analysis.positives,
        improvements: analysis.improvements,
        ...(analysis.splitAnalysis ? { splitAnalysis: analysis.splitAnalysis } : {}),
        ...(analysis.nextSession ? { nextSession: analysis.nextSession } : {}),
        voiceSummary: analysis.voiceSummary,
      });

      await ctx.runMutation(internal.activities.updateStatus, {
        activityId: args.activityId,
        processingStatus: 'complete',
      });

      console.log(`Analyzed activity ${args.activityId}`);
    } catch (err) {
      const msg = err instanceof GeminiError ? err.message : String(err);
      console.error(`Analysis failed for ${args.activityId}: ${msg}`);
      await ctx.runMutation(internal.activities.updateStatus, {
        activityId: args.activityId,
        processingStatus: 'error',
        processingError: msg.slice(0, 500),
      });
    }
  },
});

function buildWorkoutPrompt(
  activity: Doc<'activities'>,
  streams: Doc<'activityStreams'> | null,
  athlete: Doc<'athletes'> | null,
  formSnapshot: Doc<'formSnapshots'> | null,
): string {
  const distKm = (activity.distanceMeters / 1000).toFixed(2);
  const durationMin = Math.round(activity.movingTimeSec / 60);
  const paceSecPerKm =
    activity.distanceMeters > 0
      ? Math.round(activity.movingTimeSec / (activity.distanceMeters / 1000))
      : 0;
  const paceMin = Math.floor(paceSecPerKm / 60);
  const paceSec = paceSecPerKm % 60;

  let prompt = `Analyze this workout and return a JSON object with these fields:
- effortScore (1-10 integer)
- executiveSummary (2-3 sentences)
- positives (array of 2-4 short bullet points)
- improvements (array of 1-3 short bullet points)
- splitAnalysis (optional object with "trend" and "comment" fields)
- nextSession (object with "type", "durationMin", "intensity", "description" fields)
- voiceSummary (1-2 sentence audio-friendly summary)

## Workout Data
- Name: ${activity.name}
- Type: ${activity.sportType}
- Distance: ${distKm} km
- Duration: ${String(durationMin)} minutes
- Avg Pace: ${String(paceMin)}:${String(paceSec).padStart(2, '0')} /km
- Elevation Gain: ${String(activity.totalElevationGainM ?? 0)} m`;

  if (activity.averageHeartrate) {
    prompt += `\n- Avg HR: ${String(Math.round(activity.averageHeartrate))} bpm`;
  }
  if (activity.maxHeartrate) {
    prompt += `\n- Max HR: ${String(Math.round(activity.maxHeartrate))} bpm`;
  }
  if (activity.averageCadence) {
    prompt += `\n- Avg Cadence: ${String(Math.round(activity.averageCadence))} rpm`;
  }
  if (activity.calories) {
    prompt += `\n- Calories: ${String(activity.calories)}`;
  }
  if (activity.trimp) {
    prompt += `\n- TRIMP: ${String(Math.round(activity.trimp))}`;
  }

  if (activity.splitsMetric && Array.isArray(activity.splitsMetric)) {
    prompt += '\n\n## Splits (per km)';
    const splits = activity.splitsMetric as {
      split: number;
      average_speed: number;
      average_heartrate?: number;
    }[];
    for (const split of splits) {
      const splitPace = split.average_speed > 0 ? Math.round(1000 / split.average_speed) : 0;
      const splitPaceMin = Math.floor(splitPace / 60);
      const splitPaceSec = splitPace % 60;
      prompt += `\nKm ${String(split.split)}: ${String(splitPaceMin)}:${String(splitPaceSec).padStart(2, '0')} /km`;
      if (split.average_heartrate) {
        prompt += ` (${String(Math.round(split.average_heartrate))} bpm)`;
      }
    }
  }

  if (streams?.stats) {
    prompt += '\n\n## Stream Statistics';
    const s = streams.stats;
    if (s.heartrateBpm) {
      prompt += `\n- HR: min=${String(s.heartrateBpm.min)} avg=${String(s.heartrateBpm.avg)} max=${String(s.heartrateBpm.max)} bpm`;
    }
    if (s.velocitySmooth) {
      const minPace = s.velocitySmooth.min > 0 ? Math.round(1000 / s.velocitySmooth.max) : 0;
      const maxPace = s.velocitySmooth.max > 0 ? Math.round(1000 / s.velocitySmooth.min) : 0;
      prompt += `\n- Pace range: ${String(Math.floor(minPace / 60))}:${String(minPace % 60).padStart(2, '0')} - ${String(Math.floor(maxPace / 60))}:${String(maxPace % 60).padStart(2, '0')} /km`;
    }
  }

  if (athlete) {
    prompt += '\n\n## Athlete Context';
    if (athlete.sex) prompt += `\n- Sex: ${athlete.sex}`;
    if (athlete.weightKg) prompt += `\n- Weight: ${String(athlete.weightKg)} kg`;
    if (athlete.goalText) prompt += `\n- Goal: ${athlete.goalText}`;
  }

  if (formSnapshot) {
    prompt += '\n\n## Current Training Form';
    prompt += `\n- CTL (Fitness): ${String(formSnapshot.ctl)}`;
    prompt += `\n- ATL (Fatigue): ${String(formSnapshot.atl)}`;
    prompt += `\n- TSB (Form): ${String(formSnapshot.tsb)}`;
    if (formSnapshot.acwr) prompt += `\n- ACWR: ${String(formSnapshot.acwr)}`;
  }

  return prompt;
}

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

    const totalDist = weekActivities.reduce((s, a) => s + a.distanceMeters, 0);
    const totalTime = weekActivities.reduce((s, a) => s + a.movingTimeSec, 0);
    const totalElev = weekActivities.reduce((s, a) => s + (a.totalElevationGainM ?? 0), 0);
    const totalTrimp = weekActivities.reduce((s, a) => s + (a.trimp ?? 0), 0);

    const prompt = `Generate a weekly training summary. Return JSON with:
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
${formSnapshot ? `## Current Form\n- CTL: ${String(formSnapshot.ctl)}, ATL: ${String(formSnapshot.atl)}, TSB: ${String(formSnapshot.tsb)}${formSnapshot.acwr ? `, ACWR: ${String(formSnapshot.acwr)}` : ''}` : ''}`;

    try {
      const result = await generateJSON<WeeklySummaryResult>(prompt, {
        systemPrompt: COACH_SYSTEM_PROMPT,
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
      const msg = err instanceof GeminiError ? err.message : String(err);
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
        systemPrompt: COACH_SYSTEM_PROMPT,
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
      const msg = err instanceof GeminiError ? err.message : String(err);
      console.error(`Daily plan failed for ${args.athleteId}: ${msg}`);
    }
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
        systemPrompt: COACH_SYSTEM_PROMPT,
        temperature: 0.5,
        maxTokens: 512,
      });

      return { response, error: null };
    } catch (err) {
      const msg = err instanceof GeminiError ? err.message : String(err);
      console.error(`Coach chat failed: ${msg}`);
      return {
        response:
          'I apologize, but I am having trouble processing your question right now. Could you try again in a moment?',
        error: msg,
      };
    }
  },
});
