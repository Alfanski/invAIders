'use client';

import type { ReactNode } from 'react';

import type { AnalysisData } from '@/types/dashboard';

interface CoachingBreakdownProps {
  analysis: AnalysisData;
}

export function CoachingBreakdown({ analysis }: Readonly<CoachingBreakdownProps>): ReactNode {
  return (
    <section className="glass-panel space-y-5 border border-accent/20 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/20">
          <svg
            className="h-4 w-4 text-accent"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
            AI Coach Analysis
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">
            {analysis.executiveSummary}
          </p>
        </div>
        {analysis.effortScore != null && (
          <div className="shrink-0 text-center">
            <div className="text-2xl font-bold tabular-nums text-accent">
              {analysis.effortScore}
            </div>
            <div className="text-[9px] font-medium uppercase tracking-widest text-glass-text-dim">
              Effort
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {analysis.positives.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-emerald-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              What went well
            </h4>
            <ul className="space-y-1.5">
              {analysis.positives.map((p) => (
                <li key={p} className="flex items-start gap-2 text-sm text-glass-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        )}

        {analysis.improvements.length > 0 && (
          <div>
            <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-amber-400">
              <svg
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              Areas to improve
            </h4>
            <ul className="space-y-1.5">
              {analysis.improvements.map((imp) => (
                <li key={imp} className="flex items-start gap-2 text-sm text-glass-text">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                  {imp}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {analysis.nextSession && (
        <div className="glass-card p-4">
          <h4 className="mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-accent">
            <svg
              className="h-3.5 w-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            Next Session
          </h4>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
              {analysis.nextSession.type}
            </span>
            <span className="text-xs text-glass-text-muted">
              {analysis.nextSession.durationMin} min
            </span>
            <span className="text-xs text-glass-text-dim">|</span>
            <span className="text-xs text-glass-text-muted">{analysis.nextSession.intensity}</span>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-glass-text-muted">
            {analysis.nextSession.description}
          </p>
        </div>
      )}

      {analysis.weatherNote && (
        <div className="flex items-start gap-2 text-xs text-glass-text-dim">
          <svg
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z"
            />
          </svg>
          <span>{analysis.weatherNote}</span>
        </div>
      )}
    </section>
  );
}
