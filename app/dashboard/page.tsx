'use client';

import { useAction, useQuery } from 'convex/react';
import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ActivityPicker } from '@/components/dashboard/activity-picker';
import { ConnectPrompt } from '@/components/dashboard/connect-prompt';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { WorkoutView } from '@/components/dashboard/workout-view';
import { useSession } from '@/components/providers/session-provider';
import type { AnalysisData, StravaSplit, WorkoutStats, WorkoutStreams } from '@/types/dashboard';

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

function toAnalysisData(
  analysis: {
    executiveSummary: string;
    positives: string[];
    improvements: string[];
    splitAnalysis?: { trend: string; comment: string } | undefined;
    nextSession?:
      | { type: string; durationMin: number; intensity: string; description: string }
      | undefined;
    weatherNote?: string | undefined;
    effortScore?: number | undefined;
  } | null,
): AnalysisData | null {
  if (!analysis) return null;
  return {
    executiveSummary: analysis.executiveSummary,
    positives: analysis.positives,
    improvements: analysis.improvements,
    splitAnalysis: analysis.splitAnalysis ?? null,
    nextSession: analysis.nextSession ?? null,
    weatherNote: analysis.weatherNote ?? null,
    effortScore: analysis.effortScore ?? null,
  };
}

export default function DashboardPage(): ReactNode {
  const session = useSession();

  if (!session) return <ConnectPrompt />;

  return <DashboardContent athleteId={session.athleteId as Id<'athletes'>} />;
}

function DashboardContent({ athleteId }: { athleteId: Id<'athletes'> }): ReactNode {
  const recentActivities = useQuery(api.activities.getRecentForAthlete, {
    athleteId,
    limit: 20,
  });

  const [selectedId, setSelectedId] = useState<Id<'activities'> | null>(null);
  const activeId = selectedId ?? recentActivities?.[0]?._id ?? null;

  const activity = useQuery(api.activities.getById, activeId ? { activityId: activeId } : 'skip');

  const streamResult = useQuery(
    api.activityStreams.getDownsampledForActivity,
    activeId ? { activityId: activeId } : 'skip',
  );

  const analysis = useQuery(
    api.analyses.getForActivity,
    activeId ? { activityId: activeId } : 'skip',
  );

  const athleteZones = useQuery(api.athleteZones.getLatestZones, { athleteId });

  const fetchStreams = useAction(api.stravaSync.fetchStreamsOnDemand);
  const fetchedRef = useRef<Set<string>>(new Set());
  const [streamsFetching, setStreamsFetching] = useState(false);

  useEffect(() => {
    if (!activity || streamResult !== null || fetchedRef.current.has(activity.stravaActivityId)) {
      setStreamsFetching(false);
      return;
    }
    fetchedRef.current.add(activity.stravaActivityId);
    setStreamsFetching(true);
    void fetchStreams({
      athleteId,
      activityId: activity._id,
      stravaActivityId: activity.stravaActivityId,
    }).finally(() => {
      setStreamsFetching(false);
    });
  }, [activity, streamResult, fetchStreams, athleteId]);

  if (recentActivities === undefined) return <LoadingSkeleton />;

  if (recentActivities.length === 0) {
    return (
      <EmptyState
        title="No workouts yet"
        message="Your Strava activities are being synced. Check back in a minute!"
      />
    );
  }

  if (!activeId || activity === undefined) return <LoadingSkeleton />;

  if (activity === null) {
    return <EmptyState title="Activity not found" message="This activity may have been removed." />;
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

  const splits = Array.isArray(activity.splitsMetric)
    ? (activity.splitsMetric as StravaSplit[])
    : undefined;

  const latlng = streamResult?.latlng;
  const altitude = streamResult?.altitudeM;
  const distance = streamResult?.distanceM;
  const heartRateStream = streamResult?.heartrateBpm;

  const heartRateZones = athleteZones?.heartRateZones ?? undefined;

  return (
    <div className="space-y-5">
      <ActivityPicker
        activities={recentActivities}
        selectedId={activeId}
        onSelect={setSelectedId}
      />
      <WorkoutView
        title={activity.name}
        dateLabel={formatDateLabel(activity.startDate)}
        stats={stats}
        streams={streams ?? { heartRate: [], pace: [], elevation: [], cadence: [] }}
        coachingInsight={coachingInsight}
        splits={splits}
        latlng={latlng}
        altitude={altitude}
        distance={distance}
        analysis={toAnalysisData(analysis ?? null)}
        heartRateZones={heartRateZones}
        heartRateStream={heartRateStream}
        streamsLoading={streamsFetching}
      />
    </div>
  );
}
