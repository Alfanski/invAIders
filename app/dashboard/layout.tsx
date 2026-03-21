import type { ReactNode } from 'react';

import { DashboardTabBar } from '@/components/layout/dashboard-tab-bar';

export default function DashboardLayout({
  children,
}: Readonly<{ children: ReactNode }>): ReactNode {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          m<span className="text-accent">AI</span>coach
        </h1>
      </header>
      <DashboardTabBar />
      {children}
    </div>
  );
}
