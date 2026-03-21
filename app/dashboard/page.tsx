'use client';

import { useAction, useQuery } from 'convex/react';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ConnectPrompt } from '@/components/dashboard/connect-prompt';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { WorkoutView } from '@/components/dashboard/workout-view';
import { useSession } from '@/components/providers/session-provider';
import type { WorkoutStats, WorkoutStreams } from '@/types/dashboard';

function buildStreams(
  stream: {
    timeSec: number[];
    heartrateBpm?: number[];
    velocitySmooth?: number[];
    altitudeM?: number[];
    cadenceRpm?: number[];
  } | null,
): WorkoutStreams | null {
  if (!stream) return null;

  const time = stream.timeSec;

  function toPoints(data: number[] | undefined): { timeSec: number; value: number }[] {
    if (!data) return [];
    return data.map((v, i) => ({ timeSec: time[i] ?? 0, value: v }));
  }

  function velocityToPace(data: number[] | undefined): { timeSec: number; value: number }[] {
    if (!data) return [];
    return data.map((v, i) => ({
      timeSec: time[i] ?? 0,
      value: v > 0 ? 1000 / v : 0,
    }));
  }

  return {
    heartRate: toPoints(stream.heartrateBpm),
    pace: velocityToPace(stream.velocitySmooth),
    elevation: toPoints(stream.altitudeM),
    cadence: toPoints(stream.cadenceRpm),
  };
}

function formatDateLabel(startDate: string): string {
  const d = new Date(startDate);
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DashboardPage(): ReactNode {
  const session = useSession();

  if (!session) return <ConnectPrompt />;

  return <DashboardContent athleteId={session.athleteId as Id<'athletes'>} />;
}

function DashboardContent({ athleteId }: { athleteId: Id<'athletes'> }): ReactNode {
  const activity = useQuery(api.activities.getLatestForAthlete, { athleteId });

  const streamResult = useQuery(
    api.activityStreams.getDownsampledForActivity,
    activity ? { activityId: activity._id } : 'skip',
  );

  const analysis = useQuery(
    api.analyses.getForActivity,
    activity ? { activityId: activity._id } : 'skip',
  );

  const fetchStreams = useAction(api.stravaSync.fetchStreamsOnDemand);
  const fetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!activity || streamResult !== null || fetchedRef.current === activity.stravaActivityId) {
      return;
    }
    fetchedRef.current = activity.stravaActivityId;
    void fetchStreams({
      athleteId,
      activityId: activity._id,
      stravaActivityId: activity.stravaActivityId,
    });
  }, [activity, streamResult, fetchStreams, athleteId]);

  if (activity === undefined) return <LoadingSkeleton />;

  if (activity === null) {
    return (
      <EmptyState
        title="No workouts yet"
        message="Your Strava activities are being synced. Check back in a minute!"
      />
    );
  }

  const distanceKm = activity.distanceMeters / 1000;
  const paceSecPerKm = activity.movingTimeSec > 0 ? activity.movingTimeSec / distanceKm : 0;

  const stats: WorkoutStats = {
    distanceKm,
    durationSec: activity.movingTimeSec,
    paceSecPerKm,
    averageHeartRate: activity.averageHeartrate ?? 0,
    elevationGainM: activity.totalElevationGainM ?? 0,
    cadenceRpm: activity.averageCadence ?? 0,
    calories: activity.calories ?? 0,
    effort: activity.trimp ?? activity.sufferScore ?? 0,
    temperatureC: activity.averageTempC ?? 0,
  };

  const streams = buildStreams(streamResult ?? null);

  const coachingInsight = analysis
    ? analysis.executiveSummary
    : 'AI analysis will appear here once the coaching pipeline processes this activity.';

  return (
    <WorkoutView
      title={activity.name}
      dateLabel={formatDateLabel(activity.startDate)}
      stats={stats}
      streams={streams ?? { heartRate: [], pace: [], elevation: [], cadence: [] }}
      coachingInsight={coachingInsight}
    />
  );
}
