'use client';

import type { ReactNode } from 'react';

import type { DaySummary } from '@/types/dashboard';

interface WeekDayBarProps {
  days: readonly DaySummary[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
}

export function WeekDayBar({
  days,
  selectedIndex,
  onSelect,
}: Readonly<WeekDayBarProps>): ReactNode {
  return (
    <div className="glass-panel grid grid-cols-7 gap-1 p-1.5">
      {days.map((day, i) => {
        const isSelected = selectedIndex === i;
        const hasActivity = day.hasActivity;

        return (
          <button
            key={day.dayLabel}
            type="button"
            onClick={() => {
              onSelect(i);
            }}
            className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2.5 text-center transition-all ${
              isSelected
                ? 'bg-accent/20 text-white shadow-sm'
                : hasActivity
                  ? 'text-glass-text hover:bg-glass-hover hover:text-white'
                  : 'text-glass-text-dim hover:bg-glass-hover/50'
            }`}
          >
            <span className="text-[10px] font-medium uppercase tracking-wider">{day.dayShort}</span>
            <span
              className={`text-sm font-semibold tabular-nums ${
                isSelected ? 'text-white' : hasActivity ? 'text-glass-text' : 'text-glass-text-dim'
              }`}
            >
              {day.date.split(' ')[1]}
            </span>
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                hasActivity ? (isSelected ? 'bg-accent' : 'bg-accent/50') : 'bg-transparent'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
