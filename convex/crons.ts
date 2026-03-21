import { cronJobs } from 'convex/server';

import { internal } from './_generated/api';

const crons = cronJobs();

crons.interval(
  'poll Strava for new activities',
  { minutes: 15 },
  internal.stravaSync.pollNewActivities,
);

export default crons;
