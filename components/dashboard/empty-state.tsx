'use client';

import type { ReactNode } from 'react';

interface EmptyStateProps {
  title: string;
  message: string;
}

export function EmptyState({ title, message }: Readonly<EmptyStateProps>): ReactNode {
  return (
    <main className="flex flex-col items-center justify-center gap-4 py-16">
      <div className="glass-panel px-8 py-10 text-center">
        <h2 className="text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 max-w-sm text-sm text-glass-text-muted">{message}</p>
      </div>
    </main>
  );
}
