'use client';

import type { ReactNode } from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  color?: string;
  expandable?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

export function MetricCard({
  label,
  value,
  color,
  expandable = false,
  expanded = false,
  onToggle,
}: Readonly<MetricCardProps>): ReactNode {
  const baseClasses = 'glass-card p-3 text-left w-full';
  const interactiveClasses = expandable
    ? 'cursor-pointer hover:bg-glass-hover active:bg-glass-active'
    : '';
  const activeClasses = expanded ? 'ring-1 ring-accent/40 bg-glass-active' : '';

  if (expandable) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className={`${baseClasses} ${interactiveClasses} ${activeClasses}`}
      >
        <CardContent label={label} value={value} color={color} expandable expanded={expanded} />
      </button>
    );
  }

  return (
    <article className={baseClasses}>
      <CardContent label={label} value={value} />
    </article>
  );
}

interface CardContentProps {
  label: string;
  value: string;
  color?: string | undefined;
  expandable?: boolean | undefined;
  expanded?: boolean | undefined;
}

function CardContent({
  label,
  value,
  color,
  expandable = false,
  expanded = false,
}: CardContentProps): ReactNode {
  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
          {label}
        </p>
        {expandable && (
          <svg
            className={`h-3 w-3 text-glass-text-dim transition-transform duration-200 ${
              expanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      <p className="mt-1 text-lg font-semibold tracking-tight text-white">
        {color ? <span style={{ color }}>{value}</span> : value}
      </p>
    </>
  );
}
