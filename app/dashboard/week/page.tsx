import type { ReactNode } from 'react';

export default function WeekPage(): ReactNode {
  return (
    <main className="space-y-6">
      <section className="glass-panel-elevated p-5">
        <h2 className="text-xl font-semibold text-white">Week of Mar 15</h2>
        <p className="text-sm text-glass-text-muted">Mon Mar 15 -- Sun Mar 21, 2026</p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Activities', value: '5' },
          { label: 'Distance', value: '42.3 km' },
          { label: 'Duration', value: '3:48:12' },
          { label: 'Elevation', value: '412 m' },
        ].map((item) => (
          <article key={item.label} className="glass-card p-3">
            <p className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
              {item.label}
            </p>
            <p className="mt-1 text-lg font-semibold text-white">{item.value}</p>
          </article>
        ))}
      </div>

      <section className="glass-panel p-5">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-accent">
          Weekly AI Summary
        </h3>
        <p className="text-sm leading-relaxed text-glass-text-muted">
          Consistent week with good volume distribution. Distance up 8% vs last week at similar
          heart rate -- aerobic fitness is improving. Consider adding one interval session next
          week.
        </p>
      </section>
    </main>
  );
}
