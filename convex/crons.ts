import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
  'poll Strava for new activities',
  { minutes: 15 },
  internal.stravaSync.pollNewActivities,
);

crons.cron(
  'recompute form snapshots at midnight UTC',
  '0 0 * * *',
  internal.stravaSync.recomputeFormForAll,
);

crons.cron(
  'generate daily training plans',
  '0 5 * * *',
  internal.aiAnalysis.generateDailyPlanForAll,
);

crons.cron(
  'generate weekly training summaries',
  '0 6 * * 1',
  internal.aiAnalysis.generateWeeklySummaryForAll,
);

export default crons;
