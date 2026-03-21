import Link from 'next/link';
import type { ReactNode } from 'react';

const ERROR_MESSAGES: Record<string, string> = {
  strava_denied: 'You declined the Strava connection. Please try again to use mAIcoach.',
  missing_params: 'Something went wrong during login. Please try again.',
  invalid_state: 'Login session expired. Please try again.',
  oauth_failed: 'Could not connect to Strava. Please try again later.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}): Promise<ReactNode> {
  const params = await searchParams;
  const errorCode = typeof params['error'] === 'string' ? params['error'] : undefined;
  const errorMessage = errorCode ? (ERROR_MESSAGES[errorCode] ?? 'An error occurred.') : undefined;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col items-center justify-center gap-8 px-6">
      <div className="glass-panel-elevated w-full px-8 py-12 text-center sm:px-12">
        <h1 className="text-4xl font-bold tracking-tight">
          m<span className="text-accent">AI</span>coach
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-glass-text-muted">
          Your AI-powered fitness coach. Connect your Strava account to get personalized coaching
          insights, workout analysis, and voice debriefs.
        </p>

        {errorMessage && (
          <div className="mt-6 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-500 dark:text-red-300">
            {errorMessage}
          </div>
        )}

        <Link
          href="/api/auth/strava"
          className="mt-8 inline-flex items-center gap-3 rounded-lg bg-[#FC4C02] px-6 py-3 text-base font-semibold text-white shadow-lg transition hover:bg-[#E34402] active:scale-[0.98]"
        >
          <StravaLogo />
          Connect with Strava
        </Link>

        <p className="mt-6 text-xs text-glass-text-dim">
          We only read your activity data. We never post to Strava.
        </p>
      </div>
    </main>
  );
}

function StravaLogo(): ReactNode {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M15.387 17.944l-2.089-4.116h-3.065L15.387 24l5.15-10.172h-3.066m-7.008-5.599l2.836 5.598h4.172L10.463 0l-7 13.828h4.169" />
    </svg>
  );
}
