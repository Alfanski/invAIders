'use client';

import type { ReactNode } from 'react';

import { useCoach } from './coach-provider';

export function CoachOrb(): ReactNode {
  const { isOpen, open } = useCoach();

  if (isOpen) return null;

  return (
    <button
      type="button"
      onClick={open}
      className="coach-orb group fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent shadow-lg transition-transform hover:scale-110 active:scale-95"
      aria-label="Talk to your AI coach"
    >
      <div className="coach-orb-ring absolute inset-0 rounded-full" />
      <svg
        className="relative z-10 h-6 w-6 text-white transition-transform group-hover:scale-110"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={1.8}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"
        />
      </svg>
    </button>
  );
}
