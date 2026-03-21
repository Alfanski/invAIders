import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string;
}

export function StatCard({ label, value }: Readonly<StatCardProps>): ReactNode {
  return (
    <article className="glass-card p-3">
      <p className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight text-white">{value}</p>
    </article>
  );
}
