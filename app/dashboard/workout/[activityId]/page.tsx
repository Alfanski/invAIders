import type { ReactNode } from 'react';

interface WorkoutPageProps {
  params: Promise<{ activityId: string }>;
}

export default async function WorkoutPage({ params }: WorkoutPageProps): Promise<ReactNode> {
  const { activityId } = await params;

  return (
    <main className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="text-lg font-medium">Workout {activityId}</h2>
        <p className="text-sm text-slate-600">
          Route parameter uses Strava activity id string per architecture contract.
        </p>
      </section>
    </main>
  );
}
