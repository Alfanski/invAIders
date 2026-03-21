'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Workout' },
  { href: '/dashboard/week', label: 'Week' },
  { href: '/dashboard/form', label: 'Training Pulse' },
] as const;

export function DashboardTabBar(): ReactNode {
  const pathname = usePathname();

  return (
    <nav className="glass-panel grid grid-cols-3 gap-1 p-1">
      {NAV_ITEMS.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-xl px-3 py-2.5 text-center text-sm font-medium transition-all ${
              isActive
                ? 'bg-accent/20 text-white shadow-sm'
                : 'text-glass-text-muted hover:text-white hover:bg-glass-hover'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
