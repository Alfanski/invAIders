import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
  'poll Strava for new activities',
  { minutes: 15 },
  internal.stravaSync.pollNewActivities,
);

crons.daily(
  'generate daily training plans',
  { hourUTC: 5, minuteUTC: 0 },
  internal.aiAnalysis.generateDailyPlanForAll,
);

crons.weekly(
  'generate weekly training summaries',
  { dayOfWeek: 'monday', hourUTC: 6, minuteUTC: 0 },
  internal.aiAnalysis.generateWeeklySummaryForAll,
);

export default crons;
