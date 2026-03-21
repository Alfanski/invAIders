'use client';

import { useQuery } from 'convex/react';
import { useMemo } from 'react';
import type { ReactNode } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { getCoachingEngine } from '@/lib/coaching/factory';
import { computeRecovery } from '@/lib/form/recovery';
import { ConnectPrompt } from '@/components/dashboard/connect-prompt';
import { EmptyState } from '@/components/dashboard/empty-state';
import { LoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { FitnessChart } from '@/components/form/fitness-chart';
import { FormGauge } from '@/components/form/form-gauge';
import { RecoveryIndicator } from '@/components/form/recovery-indicator';
import { useSession } from '@/components/providers/session-provider';
import type { DailyFormPoint } from '@/types/form';

export default function FormPage(): ReactNode {
  const session = useSession();

  if (!session) return <ConnectPrompt />;

  return <FormContent athleteId={session.athleteId as Id<'athletes'>} />;
}

function FormContent({ athleteId }: { athleteId: Id<'athletes'> }): ReactNode {
  const formSnapshots = useQuery(api.formSnapshots.listForAthlete, { athleteId, limit: 200 });
  const activities = useQuery(api.activities.listRecentForAthlete, { athleteId, limit: 10 });
  const dailyPlan = useQuery(api.formAssessments.getLatestForAthlete, { athleteId });

  const formData = useMemo(() => {
    if (!formSnapshots || formSnapshots.length === 0) return null;

    const sorted = [...formSnapshots].sort((a, b) => a.date.localeCompare(b.date));

    const series: DailyFormPoint[] = sorted.map((snap) => ({
      date: snap.date,
      trimp: snap.dailyTrimp ?? 0,
      hasActivity: (snap.dailyTrimp ?? 0) > 0,
      ctl: snap.ctl,
      atl: snap.atl,
      tsb: snap.tsb,
    }));

    const current = series[series.length - 1];
    if (!current) return null;

    const weekAgo = series[Math.max(0, series.length - 8)] ?? current;

    return {
      series,
      current,
      trend7d: {
        ctl: Math.round((current.ctl - weekAgo.ctl) * 10) / 10,
        atl: Math.round((current.atl - weekAgo.atl) * 10) / 10,
        tsb: Math.round((current.tsb - weekAgo.tsb) * 10) / 10,
      },
    };
  }, [formSnapshots]);

  const recoveryData = useMemo(() => {
    if (!activities || activities.length === 0) return null;

    const lastActivity = activities[0];
    if (!lastActivity) return null;

    const hoursSince = (Date.now() - new Date(lastActivity.startDate).getTime()) / (1000 * 60 * 60);
    const lastTrimp =
      lastActivity.trimp ??
      lastActivity.sufferScore ??
      Math.round((lastActivity.movingTimeSec / 60) * 1.2);

    return { hoursSince, lastTrimp };
  }, [activities]);

  if (formSnapshots === undefined || activities === undefined) return <LoadingSkeleton />;

  if (!formData) {
    return (
      <EmptyState
        title="Not enough data"
        message="Complete a few workouts on Strava so we can compute your training form."
      />
    );
  }

  const engine = getCoachingEngine();
  const zone = engine.classifyForm(formData.current.tsb);

  const formSignals = {
    tsb: formData.current.tsb,
    ...(formSnapshots[0]?.acwr != null ? { acwr: formSnapshots[0].acwr } : {}),
  };

  const recovery = recoveryData
    ? computeRecovery(recoveryData.hoursSince, recoveryData.lastTrimp, formSignals)
    : computeRecovery(999, 0, formSignals);

  const hasPlan = dailyPlan?.executiveSummary && dailyPlan.executiveSummary.length > 0;

  return (
    <main className="space-y-5">
      <FormGauge
        tsb={formData.current.tsb}
        ctl={formData.current.ctl}
        atl={formData.current.atl}
        zone={zone}
        trend7d={formData.trend7d}
      />

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
            {hasPlan ? (
              <>
                <p className="mt-1.5 text-sm leading-relaxed text-glass-text">
                  {dailyPlan.executiveSummary}
                </p>
                {dailyPlan.recommendations.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {dailyPlan.recommendations.map((rec: string) => (
                      <li key={rec} className="text-xs leading-relaxed text-glass-text-muted">
                        &bull; {rec}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">
                Daily recommendations will appear once the coaching pipeline processes your data.
              </p>
            )}
          </div>
        </div>
      </section>

      <RecoveryIndicator recovery={recovery} />
      <FitnessChart series={formData.series} />
    </main>
  );
}
