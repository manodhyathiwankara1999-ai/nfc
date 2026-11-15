'use client';

import { SignOutButton } from '@/components/layout/SignOutButton';

export function DashboardLoadError({ statusCode }: { statusCode: number }) {
  const message =
    statusCode === 401
      ? 'Your login session has expired or could not be verified. Sign out, then log in again.'
      : statusCode === 403
        ? 'Your account is signed in but is not allowed to open this dashboard. Contact support if you believe this is a mistake.'
        : statusCode === 502
          ? 'The account service returned a response the dashboard could not read. Try again, and contact support if it continues.'
          : statusCode === 503
            ? 'The authentication or account service is temporarily unavailable. Check your connection and try again.'
            : 'The dashboard could not load your account. Try again, or sign out and log in again.';

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-4 py-8">
      <section className="app-card w-full max-w-lg p-6 sm:p-8">
        <h1 className="text-2xl font-bold tracking-tight">We couldn’t load your dashboard</h1>
        <p className="mt-3 text-sm leading-6 text-app-secondary">{message}</p>
        <p className="mt-3 text-xs text-slate-500">
          Status code: {statusCode}. Include this code if you contact support.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="app-button-primary"
          >
            Try again
          </button>
          <SignOutButton className="app-button-secondary" />
        </div>
      </section>
    </main>
  );
}
