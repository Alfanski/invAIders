'use client';

import type { ReactNode } from 'react';

import { useCoach } from '@/components/coach/coach-provider';

export function DashboardShell({ children }: Readonly<{ children: ReactNode }>): ReactNode {
  const { isOpen } = useCoach();

  return (
    <div
      className={`min-h-screen w-full transition-[padding] duration-300 ease-out ${
        isOpen ? 'sm:pr-[420px]' : ''
      }`}
    >
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        {children}
      </div>
    </div>
  );
}
