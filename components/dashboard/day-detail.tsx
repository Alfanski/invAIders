'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { formatDuration, formatPace } from '@/lib/units';
import type { DaySummary } from '@/types/dashboard';

interface DayDetailProps {
  day: DaySummary;
}

interface DetailRowProps {
  label: string;
  value: string;
  color?: string | undefined;
}

function DetailRow({ label, value, color }: DetailRowProps): ReactNode {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-xs text-glass-text-muted">{label}</span>
      <span
        className="text-sm font-semibold tabular-nums text-white"
        style={color ? { color } : undefined}
      >
        {value}
      </span>
    </div>
  );
}

export function DayDetail({ day }: Readonly<DayDetailProps>): ReactNode {
  if (!day.hasActivity) {
    return (
      <div className="glass-panel p-5">
        <div className="flex flex-col items-center gap-2 py-4 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-glass">
            <svg
              className="h-5 w-5 text-glass-text-dim"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.182 15.182a4.5 4.5 0 01-6.364 0M21 12a9 9 0 11-18 0 9 9 0 0118 0zM9.75 9.75c.414 0 .75-.336.75-.75s-.336-.75-.75-.75S9 8.586 9 9s.336.75.75.75zm4.5 0c.414 0 .75-.336.75-.75s-.336-.75-.75-.75-.75.336-.75.75.336.75.75.75z"
              />
            </svg>
          </div>
          <p className="text-sm font-medium text-glass-text-muted">{day.dayLabel} -- Rest Day</p>
          <p className="text-xs text-glass-text-dim">No activity recorded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel p-5">
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h4 className="text-base font-semibold text-white">{day.activityName}</h4>
          <p className="mt-0.5 text-xs text-glass-text-muted">
            {day.dayLabel}, {day.date} -- {day.activityType}
          </p>
        </div>
        <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
          {day.activityType}
        </span>
      </div>

      <div className="divide-y divide-glass-border">
        {day.distanceKm !== undefined && (
          <DetailRow label="Distance" value={`${day.distanceKm.toFixed(1)} km`} />
        )}
        {day.durationSec !== undefined && (
          <DetailRow label="Duration" value={formatDuration(day.durationSec)} />
        )}
        {day.paceSecPerKm !== undefined && (
          <DetailRow label="Avg Pace" value={formatPace(day.paceSecPerKm)} color="#34d399" />
        )}
        {day.averageHeartRate !== undefined && (
          <DetailRow
            label="Avg Heart Rate"
            value={`${String(day.averageHeartRate)} bpm`}
            color="#f87171"
          />
        )}
        {day.elevationGainM !== undefined && (
          <DetailRow
            label="Elevation Gain"
            value={`${String(Math.round(day.elevationGainM))} m`}
            color="#60a5fa"
          />
        )}
        {day.calories !== undefined && (
          <DetailRow label="Calories" value={`${String(Math.round(day.calories))} kcal`} />
        )}
        {day.effort !== undefined && (
          <DetailRow
            label="Training Load"
            value={`${String(Math.round(day.effort))} TRIMP`}
            color="#c084fc"
          />
        )}
      </div>

      {day.activityId && (
        <div className="mt-4 border-t border-glass-border pt-3">
          <Link
            href={`/dashboard/workout/${day.activityId}`}
            className="flex items-center justify-center gap-2 rounded-xl bg-accent/15 px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent/25"
          >
            View full workout
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      )}
    </div>
  );
}
