'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { getAdminOverview } from '@/lib/api/admin';

export function AdminOverviewPage() {
  const overview = useQuery({ queryKey: ['admin', 'overview'], queryFn: getAdminOverview });
  if (overview.isLoading) return <p className="text-sm text-app-secondary">Loading overview…</p>;
  if (overview.isError) {
    return (
      <ErrorState message="Could not load the overview." onRetry={() => void overview.refetch()} />
    );
  }
  const data = overview.data;
  if (!data) return null;
  const metrics = [
    ['Users', data.users],
    ['Cards', data.cards],
    ['Active cards', data.activeCards],
    ['Inactive cards', data.inactiveCards],
  ];
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-app-text">Overview</h1>
        <p className="mt-2 text-sm text-app-secondary">Platform totals at a glance.</p>
      </header>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <article key={label} className="app-card p-5 sm:p-6">
            <p className="text-sm font-medium text-app-secondary">{label}</p>
            <p className="mt-3 text-3xl font-bold tracking-tight text-app-text">{value}</p>
          </article>
        ))}
      </section>
      <nav className="flex flex-wrap gap-3">
        <Link href="/super-admin/cards" className="app-button-primary inline-flex items-center">
          Manage cards
        </Link>
        <Link href="/super-admin/users" className="app-button-secondary inline-flex items-center">
          View users
        </Link>
        <Link
          href="/super-admin/audit-logs"
          className="app-button-secondary inline-flex items-center"
        >
          Audit log
        </Link>
      </nav>
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"
    >
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
        Retry
      </button>
    </div>
  );
}
