'use client';

import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ConnectPrompt } from '@/components/dashboard/connect-prompt';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { WeekView } from '@/components/dashboard/week-view';
import { useSession } from '@/components/providers/session-provider';
import type { DaySummary, WeekData } from '@/types/dashboard';

const DAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_SHORTS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getWeekBounds(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function formatWeekLabel(start: Date): string {
  return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function formatDateRange(start: Date, end: Date): string {
  const fmt = (d: Date): string =>
    d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  return `${fmt(start)} – ${fmt(end)}`;
}

interface ActivityDoc {
  startDate: string;
  name: string;
  sportType: string;
  distanceMeters: number;
  movingTimeSec: number;
  totalElevationGainM?: number;
  averageHeartrate?: number;
  calories?: number;
  trimp?: number;
  sufferScore?: number;
}

function buildWeekData(activities: readonly ActivityDoc[], start: Date, end: Date): WeekData {
  const activityByDay = new Map<number, ActivityDoc[]>();

  for (const a of activities) {
    const d = new Date(a.startDate);
    if (d >= start && d <= end) {
      const day = d.getDay();
      const existing = activityByDay.get(day) ?? [];
      existing.push(a);
      activityByDay.set(day, existing);
    }
  }

  const dayOrder = [1, 2, 3, 4, 5, 6, 0]; // Mon-Sun

  const days: DaySummary[] = dayOrder.map((dayOfWeek, i) => {
    const date = new Date(start);
    date.setDate(start.getDate() + i);
    const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    const dayActivities = activityByDay.get(dayOfWeek) ?? [];

    if (dayActivities.length === 0) {
      return {
        dayLabel: DAY_LABELS[dayOfWeek] ?? '',
        dayShort: DAY_SHORTS[dayOfWeek] ?? '',
        date: dateStr,
        hasActivity: false,
      };
    }

    const primary = dayActivities[0];
    if (!primary) {
      return {
        dayLabel: DAY_LABELS[dayOfWeek] ?? '',
        dayShort: DAY_SHORTS[dayOfWeek] ?? '',
        date: dateStr,
        hasActivity: false,
      };
    }
    const totalDistance = dayActivities.reduce((s, a) => s + a.distanceMeters, 0);
    const totalTime = dayActivities.reduce((s, a) => s + a.movingTimeSec, 0);
    const totalElev = dayActivities.reduce((s, a) => s + (a.totalElevationGainM ?? 0), 0);
    const totalCals = dayActivities.reduce((s, a) => s + (a.calories ?? 0), 0);
    const totalEffort = dayActivities.reduce((s, a) => s + (a.trimp ?? a.sufferScore ?? 0), 0);
    const avgHr =
      dayActivities.reduce((s, a) => s + (a.averageHeartrate ?? 0), 0) / dayActivities.length;
    const distanceKm = totalDistance / 1000;
    const paceSecPerKm = distanceKm > 0 ? totalTime / distanceKm : 0;

    return {
      dayLabel: DAY_LABELS[dayOfWeek] ?? '',
      dayShort: DAY_SHORTS[dayOfWeek] ?? '',
      date: dateStr,
      hasActivity: true,
      activityType: primary.sportType,
      activityName:
        dayActivities.length > 1
          ? `${primary.name} + ${String(dayActivities.length - 1)} more`
          : primary.name,
      distanceKm: Math.round(distanceKm * 10) / 10,
      durationSec: totalTime,
      paceSecPerKm: Math.round(paceSecPerKm),
      averageHeartRate: Math.round(avgHr),
      elevationGainM: Math.round(totalElev),
      calories: Math.round(totalCals),
      effort: Math.round(totalEffort),
    };
  });

  const activeDays = days.filter((d) => d.hasActivity);
  const totals = {
    activities: activeDays.length,
    distanceKm: Math.round(days.reduce((s, d) => s + (d.distanceKm ?? 0), 0) * 10) / 10,
    durationSec: days.reduce((s, d) => s + (d.durationSec ?? 0), 0),
    elevationGainM: days.reduce((s, d) => s + (d.elevationGainM ?? 0), 0),
    calories: days.reduce((s, d) => s + (d.calories ?? 0), 0),
    effort: days.reduce((s, d) => s + (d.effort ?? 0), 0),
  };

  return {
    weekLabel: formatWeekLabel(start),
    dateRange: formatDateRange(start, end),
    days,
    totals,
    aiSummary: 'Weekly AI summary will appear once the analysis pipeline is active.',
  };
}

export default function WeekPage(): ReactNode {
  const session = useSession();

  if (!session) return <ConnectPrompt />;

  return <WeekContent athleteId={session.athleteId as Id<'athletes'>} />;
}

function WeekContent({ athleteId }: { athleteId: Id<'athletes'> }): ReactNode {
  const activities = useQuery(api.activities.listRecentForAthlete, { athleteId, limit: 50 });

  const { start, end } = useMemo(getWeekBounds, []);

  const weekStartLocal = useMemo(() => {
    const s = new Date(start);
    return s.toISOString().slice(0, 10);
  }, [start]);

  const weeklyAnalysis = useQuery(api.weeklyAnalyses.getForAthleteWeek, {
    athleteId,
    weekStartLocal,
  });

  const week = useMemo(() => {
    if (!activities) return null;
    const data = buildWeekData(activities, start, end);
    if (weeklyAnalysis?.executiveSummary) {
      data.aiSummary = weeklyAnalysis.executiveSummary;
    }
    return data;
  }, [activities, start, end, weeklyAnalysis]);

  if (activities === undefined) return <LoadingSkeleton />;

  if (!week || week.totals.activities === 0) {
    return (
      <EmptyState
        title="No activities this week"
        message="Complete a workout on Strava and it will show up here automatically."
      />
    );
  }

  return <WeekView week={week} />;
}
