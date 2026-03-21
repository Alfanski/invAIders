import type { ReactNode } from 'react';

export default function FormPage(): ReactNode {
  return (
    <main className="space-y-6">
      <section className="glass-panel-elevated p-5">
        <h2 className="text-xl font-semibold text-white">Coach Status</h2>
        <p className="text-sm text-glass-text-muted">Your current training form</p>
      </section>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {[
          { label: 'Fitness (CTL)', value: '62.4', color: 'text-coach-ctl' },
          { label: 'Fatigue (ATL)', value: '71.8', color: 'text-coach-atl' },
          { label: 'Form (TSB)', value: '-9.4', color: 'text-coach-tsb' },
        ].map((metric) => (
          <article key={metric.label} className="glass-card p-4">
            <p className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
              {metric.label}
            </p>
            <p className={`mt-1 text-2xl font-bold ${metric.color}`}>{metric.value}</p>
          </article>
        ))}
      </div>

      <section className="glass-panel p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
          Form Assessment
        </h3>
        <p className="text-sm leading-relaxed text-glass-text-muted">
          You are in a balanced training state -- absorbing recent load well. Current TSB of -9.4
          indicates productive fatigue without overreaching risk. One more easy day before your next
          hard session.
        </p>
      </section>
    </main>
  );
}
