'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAction, useQuery } from 'convex/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ActivityPicker } from '@/components/dashboard/activity-picker';
import { ConnectPrompt } from '@/components/dashboard/connect-prompt';
import { LoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { EmptyState } from '@/components/dashboard/empty-state';
import { WorkoutView } from '@/components/dashboard/workout-view';
import { useSession } from '@/components/providers/session-provider';
import { buildStreams, formatDateLabel, toAnalysisData } from '@/lib/activity-helpers';
import { toBucket } from '@/lib/sport-config';
import type { StravaSplit, WorkoutStats } from '@/types/dashboard';

export default function WorkoutPage(): ReactNode {
  const session = useSession();

  if (!session) return <ConnectPrompt />;

  return <WorkoutContent athleteId={session.athleteId as Id<'athletes'>} />;
}

function WorkoutContent({ athleteId }: { athleteId: Id<'athletes'> }): ReactNode {
  const params = useParams<{ activityId: string }>();
  const activityId = params.activityId as Id<'activities'>;
  const router = useRouter();

  const recentActivities = useQuery(api.activities.getRecentForAthlete, {
    athleteId,
    limit: 20,
  });

  const handlePickActivity = useCallback(
    (id: Id<'activities'>) => {
      router.push(`/dashboard/workout/${id}`);
    },
    [router],
  );

  const activity = useQuery(api.activities.getById, { activityId });

  const streamResult = useQuery(api.activityStreams.getDownsampledForActivity, { activityId });

  const analysis = useQuery(api.analyses.getForActivity, { activityId });

  const athleteZones = useQuery(api.athleteZones.getLatestZones, { athleteId });

  const gearResult = useQuery(
    api.gear.getByStravaGearIdPublic,
    activity?.stravaGearId ? { athleteId, stravaGearId: activity.stravaGearId } : 'skip',
  );

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

  if (activity === undefined) return <LoadingSkeleton />;

  if (activity === null) {
    return <EmptyState title="Activity not found" message="This activity may have been removed." />;
  }

  const bucket = toBucket(activity.sportType);
  const distanceKm = activity.distanceMeters / 1000;
  const paceSecPerKm = activity.movingTimeSec > 0 ? activity.movingTimeSec / distanceKm : 0;

  const stats: WorkoutStats = {
    activityBucket: bucket,
    distanceKm,
    durationSec: activity.movingTimeSec,
    paceSecPerKm,
    averageHeartRate: activity.averageHeartrate ?? 0,
    elevationGainM: activity.totalElevationGainM ?? 0,
    cadenceRpm: activity.averageCadence ?? 0,
    averageWatts: activity.averageWatts ?? 0,
    calories: activity.calories ?? 0,
    effort: activity.trimp ?? activity.sufferScore ?? 0,
    temperatureC: activity.averageTempC ?? 0,
  };

  const streams = buildStreams(streamResult ?? null, bucket);

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

  const gear = gearResult
    ? {
        name: gearResult.name,
        gearType: gearResult.gearType,
        distanceKm: gearResult.distanceMeters / 1000,
        brandName: gearResult.brandName ?? null,
        modelName: gearResult.modelName ?? null,
      }
    : undefined;

  return (
    <div className="space-y-4">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-medium text-glass-text-muted transition hover:text-white"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M11 17l-5-5m0 0l5-5m-5 5h12" />
        </svg>
        Back to dashboard
      </Link>
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
        gear={gear}
      />
      {recentActivities && (
        <ActivityPicker
          activities={recentActivities}
          selectedId={activityId}
          onSelect={handlePickActivity}
        />
      )}
    </div>
  );
}
