import type { ReactNode } from 'react';

import { getCoachingEngine } from '@/lib/coaching/factory';
import { generateMockFormData } from '@/lib/mock-form';

import { FitnessChart } from '@/components/form/fitness-chart';
import { FormGauge } from '@/components/form/form-gauge';
import { RecoveryIndicator } from '@/components/form/recovery-indicator';

export default function FormPage(): ReactNode {
  const engine = getCoachingEngine();
  const data = generateMockFormData();
  const zone = engine.classifyForm(data.current.tsb);

  return (
    <main className="space-y-5">
      <FormGauge
        tsb={data.current.tsb}
        ctl={data.current.ctl}
        atl={data.current.atl}
        zone={zone}
        trend7d={data.trend7d}
      />

      {/* Today's recommendation -- AI-driven, prominent */}
      <section className="glass-panel border border-accent/20 p-5">
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
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
              Today&apos;s Plan
            </h3>
            <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">{data.todayRec}</p>
          </div>
        </div>
      </section>

      <RecoveryIndicator recovery={data.recovery} />
      <FitnessChart series={data.series} />
    </main>
  );
}
