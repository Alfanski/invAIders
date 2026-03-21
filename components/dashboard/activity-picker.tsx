'use client';

import { useEffect, useRef, useState } from 'react';
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

export function ActivityPicker({
  activities,
  selectedId,
  onSelect,
}: Readonly<ActivityPickerProps>): ReactNode {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
    };
  }, [open]);

  if (activities.length < 2) return null;

  const selected = activities.find((a) => a._id === selectedId) ?? activities[0];
  if (!selected) return null;

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((p) => !p);
        }}
        className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-glass-text-muted transition-colors hover:bg-glass-hover hover:text-glass-text"
      >
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: sportColor(selected.sportType) }}
        />
        <span className="font-medium">{selected.name}</span>
        <span className="text-glass-text-dim">{formatShortDate(selected.startDate)}</span>
        <svg
          className={`h-3 w-3 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 max-h-64 w-72 overflow-y-auto rounded-xl border border-glass-border shadow-xl backdrop-blur-xl scrollbar-hide"
          style={{ backgroundColor: 'var(--surface-tooltip)' }}
        >
          {activities.map((a) => {
            const isSelected = a._id === selectedId;
            const color = sportColor(a.sportType);
            const distKm = a.distanceMeters / 1000;

            return (
              <button
                key={a._id}
                type="button"
                onClick={() => {
                  onSelect(a._id);
                  setOpen(false);
                }}
                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors ${
                  isSelected
                    ? 'bg-accent/15 text-glass-text'
                    : 'text-glass-text-muted hover:bg-glass-hover hover:text-glass-text'
                }`}
              >
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="min-w-0 flex-1 truncate text-xs font-medium">{a.name}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-glass-text-dim">
                  {distKm.toFixed(1)} km
                </span>
                <span className="shrink-0 text-[10px] text-glass-text-dim">
                  {formatShortDate(a.startDate)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
