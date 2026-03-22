'use client';

import { useMutation, useQuery } from 'convex/react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';

import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { COACH_PERSONALITY_OPTIONS } from '@/lib/coach-personalities';
import { ConnectPrompt } from '@/components/dashboard/connect-prompt';
import { LoadingSkeleton } from '@/components/dashboard/loading-skeleton';
import { useSession } from '@/components/providers/session-provider';

export default function ProfilePage(): ReactNode {
  const session = useSession();

  if (!session) return <ConnectPrompt />;

  return <ProfileContent athleteId={session.athleteId as Id<'athletes'>} />;
}

interface FormState {
  goalText: string;
  weightKg: string;
  heightCm: string;
  restingHr: string;
  maxHr: string;
  coachPersonality: string;
}

function ProfileContent({ athleteId }: Readonly<{ athleteId: Id<'athletes'> }>): ReactNode {
  const profile = useQuery(api.athletes.getFullProfile, { athleteId });
  const updateProfile = useMutation(api.athletes.updateProfile);

  const [form, setForm] = useState<FormState>({
    goalText: '',
    weightKg: '',
    heightCm: '',
    restingHr: '',
    maxHr: '',
    coachPersonality: '',
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!profile) return;
    setForm({
      goalText: profile.goalText ?? '',
      weightKg: profile.weightKg != null ? String(profile.weightKg) : '',
      heightCm: profile.heightCm != null ? String(profile.heightCm) : '',
      restingHr: profile.restingHr != null ? String(profile.restingHr) : '',
      maxHr: profile.maxHr != null ? String(profile.maxHr) : '',
      coachPersonality: profile.coachPersonality ?? '',
    });
  }, [profile]);

  const handleSubmit = useCallback(
    async (e: SyntheticEvent) => {
      e.preventDefault();
      setSaving(true);
      setSaved(false);
      setError(null);

      try {
        const args: Parameters<typeof updateProfile>[0] = {
          athleteId,
          goalText: form.goalText,
          ...(form.coachPersonality ? { coachPersonality: form.coachPersonality } : {}),
        };
        if (form.weightKg) args.weightKg = Number(form.weightKg);
        if (form.heightCm) args.heightCm = Number(form.heightCm);
        if (form.restingHr) args.restingHr = Number(form.restingHr);
        if (form.maxHr) args.maxHr = Number(form.maxHr);
        await updateProfile(args);
        setSaved(true);
        setTimeout(() => {
          setSaved(false);
        }, 2500);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save');
      } finally {
        setSaving(false);
      }
    },
    [athleteId, form, updateProfile],
  );

  if (profile === undefined) return <LoadingSkeleton />;

  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(' ');

  return (
    <main className="space-y-5">
      {/* Back link */}
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-xs text-glass-text-muted transition-colors hover:text-glass-text"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to dashboard
      </Link>

      {/* Profile header */}
      <section className="glass-panel-elevated p-5">
        <div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-glass-text">
              {name || 'Athlete'}
            </h2>
            <div className="mt-0.5 flex items-center gap-3 text-xs text-glass-text-muted">
              {profile?.sex && <span>{profile.sex === 'M' ? 'Male' : 'Female'}</span>}
              {profile?.timezone && <span>{profile.timezone}</span>}
              {profile?.measurementPreference && (
                <span className="rounded-md bg-accent/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-accent">
                  {profile.measurementPreference}
                </span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Current info display */}
      <section className="glass-panel p-5">
        <h3 className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
          Current Stats
        </h3>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Weight" value={profile?.weightKg} unit="kg" />
          <StatCard label="Height" value={profile?.heightCm} unit="cm" />
          <StatCard label="Resting HR" value={profile?.restingHr} unit="bpm" />
          <StatCard label="Max HR" value={profile?.maxHr} unit="bpm" />
        </div>
      </section>

      {/* Goal display */}
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
                d="M3 3v1.5M3 21v-6m0 0l2.77-.693a9 9 0 016.208.682l.108.054a9 9 0 006.086.71l3.114-.732a48.524 48.524 0 01-.005-10.499l-3.11.732a9 9 0 01-6.085-.711l-.108-.054a9 9 0 00-6.208-.682L3 4.5M3 15V4.5"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
              Personal Goal
            </h3>
            {profile?.goalText ? (
              <p className="mt-1.5 text-sm leading-relaxed text-glass-text">{profile.goalText}</p>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">
                No goal set yet -- add one below to personalize your coaching
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Coach personality display */}
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
                d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z"
              />
            </svg>
          </div>
          <div className="flex-1">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-accent">
              Coach Personality
            </h3>
            {profile?.coachPersonality ? (
              <p className="mt-1.5 text-sm leading-relaxed text-glass-text">
                {COACH_PERSONALITY_OPTIONS.find((p) => p.id === profile.coachPersonality)?.label ??
                  'Custom'}{' '}
                <span className="text-glass-text-muted">
                  &mdash;{' '}
                  {COACH_PERSONALITY_OPTIONS.find((p) => p.id === profile.coachPersonality)
                    ?.tagline ?? ''}
                </span>
              </p>
            ) : (
              <p className="mt-1.5 text-sm leading-relaxed text-glass-text-muted">
                No personality set -- your coach uses the default balanced style
              </p>
            )}
          </div>
        </div>
      </section>

      {/* Edit form */}
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
        <section className="glass-panel p-5">
          <h3 className="text-[11px] font-medium uppercase tracking-widest text-glass-text-dim">
            Edit Profile
          </h3>

          {/* Goal */}
          <label className="mt-4 block">
            <span className="text-xs font-medium text-glass-text-muted">Training Goal</span>
            <textarea
              value={form.goalText}
              onChange={(e) => {
                setForm((prev) => ({ ...prev, goalText: e.target.value }));
              }}
              placeholder='e.g. "Sub-3:30 marathon in October" or "Complete my first 100km ride"'
              rows={3}
              className="mt-1 w-full resize-none rounded-xl bg-glass px-3 py-2 text-sm text-glass-text placeholder-glass-text-dim outline-none ring-1 ring-glass-border transition-shadow focus:ring-accent/40"
            />
          </label>

          {/* Body metrics */}
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <label className="block">
              <span className="text-xs font-medium text-glass-text-muted">Weight (kg)</span>
              <input
                type="number"
                min={30}
                max={200}
                step={0.1}
                value={form.weightKg}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, weightKg: e.target.value }));
                }}
                placeholder="--"
                className="mt-1 w-full rounded-xl bg-glass px-3 py-2 text-sm tabular-nums text-glass-text placeholder-glass-text-dim outline-none ring-1 ring-glass-border transition-shadow focus:ring-accent/40"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-glass-text-muted">Height (cm)</span>
              <input
                type="number"
                min={100}
                max={250}
                step={1}
                value={form.heightCm}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, heightCm: e.target.value }));
                }}
                placeholder="--"
                className="mt-1 w-full rounded-xl bg-glass px-3 py-2 text-sm tabular-nums text-glass-text placeholder-glass-text-dim outline-none ring-1 ring-glass-border transition-shadow focus:ring-accent/40"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-glass-text-muted">Resting HR (bpm)</span>
              <input
                type="number"
                min={30}
                max={120}
                step={1}
                value={form.restingHr}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, restingHr: e.target.value }));
                }}
                placeholder="--"
                className="mt-1 w-full rounded-xl bg-glass px-3 py-2 text-sm tabular-nums text-glass-text placeholder-glass-text-dim outline-none ring-1 ring-glass-border transition-shadow focus:ring-accent/40"
              />
            </label>

            <label className="block">
              <span className="text-xs font-medium text-glass-text-muted">Max HR (bpm)</span>
              <input
                type="number"
                min={100}
                max={230}
                step={1}
                value={form.maxHr}
                onChange={(e) => {
                  setForm((prev) => ({ ...prev, maxHr: e.target.value }));
                }}
                placeholder="--"
                className="mt-1 w-full rounded-xl bg-glass px-3 py-2 text-sm tabular-nums text-glass-text placeholder-glass-text-dim outline-none ring-1 ring-glass-border transition-shadow focus:ring-accent/40"
              />
            </label>
          </div>

          {/* Coach personality */}
          <div className="mt-6">
            <span className="text-xs font-medium text-glass-text-muted">Coach Personality</span>
            <p className="mt-0.5 text-[10px] text-glass-text-dim">
              Choose how your AI coach communicates with you
            </p>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {COACH_PERSONALITY_OPTIONS.map((personality) => {
                const isSelected = form.coachPersonality === personality.id;
                return (
                  <button
                    key={personality.id}
                    type="button"
                    onClick={() => {
                      setForm((prev) => ({
                        ...prev,
                        coachPersonality:
                          prev.coachPersonality === personality.id ? '' : personality.id,
                      }));
                    }}
                    className={`rounded-xl p-3 text-left transition-all ${
                      isSelected
                        ? 'bg-accent/20 ring-1 ring-accent/40'
                        : 'bg-glass hover:bg-glass-hover ring-1 ring-glass-border'
                    }`}
                  >
                    <span
                      className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-glass-text'}`}
                    >
                      {personality.label}
                    </span>
                    <p className="mt-0.5 text-[11px] text-glass-text-muted">
                      {personality.tagline}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white shadow-lg transition hover:brightness-110 disabled:opacity-20 glow-accent"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>

          {saved && (
            <span className="text-xs font-medium text-green-500 dark:text-green-400">Saved</span>
          )}
          {error && (
            <span className="text-xs font-medium text-red-500 dark:text-red-300">{error}</span>
          )}
        </div>
      </form>
    </main>
  );
}

interface StatCardProps {
  label: string;
  value: number | null | undefined;
  unit: string;
}

function StatCard({ label, value, unit }: Readonly<StatCardProps>): ReactNode {
  return (
    <div className="glass-card p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-glass-text-dim">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tracking-tight tabular-nums text-glass-text">
        {value ?? '--'}
        {value != null && (
          <span className="ml-0.5 text-xs font-normal text-glass-text-muted">{unit}</span>
        )}
      </p>
    </div>
  );
}
