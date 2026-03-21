import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
  'sync-new-strava-activities',
  { minutes: 5 },
  internal.stravaSync.syncNewActivities,
  {},
);

export default crons;
