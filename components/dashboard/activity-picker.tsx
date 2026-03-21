'use client';

import { useRef, useEffect } from 'react';
import type { ReactNode } from 'react';

import type { Id } from '@/convex/_generated/dataModel';

interface ActivitySummary {
  _id: Id<'activities'>;
  name: string;
  sportType: string;
  startDate: string;
  distanceMeters: number;
  movingTimeSec: number;
}

interface ActivityPickerProps {
  activities: readonly ActivitySummary[];
  selectedId: Id<'activities'>;
  onSelect: (id: Id<'activities'>) => void;
}

const SPORT_COLORS: Record<string, string> = {
  Run: '#34d399',
  TrailRun: '#34d399',
  VirtualRun: '#34d399',
  Ride: '#60a5fa',
  VirtualRide: '#60a5fa',
  MountainBikeRide: '#60a5fa',
  GravelRide: '#60a5fa',
  Swim: '#38bdf8',
  Walk: '#a78bfa',
  Hike: '#a78bfa',
};

function sportColor(sportType: string): string {
  return SPORT_COLORS[sportType] ?? '#94a3b8';
}

function formatShortDate(startDate: string): string {
  const d = new Date(startDate);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 1) + '\u2026';
}

export function ActivityPicker({
  activities,
  selectedId,
  onSelect,
}: Readonly<ActivityPickerProps>): ReactNode {
  const scrollRef = useRef<HTMLDivElement>(null);
  const selectedRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const el = selectedRef.current;
      const left = el.offsetLeft - container.offsetLeft - 8;
      container.scrollTo({ left, behavior: 'smooth' });
    }
  }, [selectedId]);

  if (activities.length < 2) return null;

  return (
    <section>
      <h3 className="mb-2 text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
        Workouts
      </h3>
      <div ref={scrollRef} className="scrollbar-hide -mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        {activities.map((a) => {
          const isSelected = a._id === selectedId;
          const color = sportColor(a.sportType);
          const distKm = a.distanceMeters / 1000;

          return (
            <button
              key={a._id}
              ref={isSelected ? selectedRef : undefined}
              type="button"
              onClick={() => {
                onSelect(a._id);
              }}
              className={`flex shrink-0 flex-col gap-0.5 rounded-xl px-3 py-2 text-left transition-all ${
                isSelected
                  ? 'bg-accent/20 ring-1 ring-accent/40 shadow-sm'
                  : 'bg-glass hover:bg-glass-hover'
              }`}
              style={{ minWidth: '7.5rem' }}
            >
              <div className="flex items-center gap-1.5">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-[10px] font-medium uppercase tracking-wider text-glass-text-dim">
                  {formatShortDate(a.startDate)}
                </span>
              </div>
              <span className="text-xs font-semibold text-glass-text">{truncate(a.name, 18)}</span>
              <span className="tabular-nums text-[10px] text-glass-text-muted">
                {distKm.toFixed(1)} km
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
