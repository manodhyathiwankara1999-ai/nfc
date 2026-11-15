'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminAuditLogs } from '@/lib/api/admin';
import { ErrorState } from './AdminOverviewPage';

export function AdminAuditLogsPage() {
  const [page, setPage] = useState(1);
  const logs = useQuery({
    queryKey: ['admin', 'audit-logs', page],
    queryFn: () => getAdminAuditLogs(page),
  });
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-app-text">Audit log</h1>
        <p className="mt-2 text-sm text-app-secondary">Latest administrative activity first.</p>
      </header>
      {logs.isLoading && <p className="text-sm text-slate-600">Loading audit log…</p>}
      {logs.isError && (
        <ErrorState message="Could not load the audit log." onRetry={() => void logs.refetch()} />
      )}
      {logs.data && (
        <>
          <div className="grid gap-3 sm:hidden">
            {logs.data.items.map((entry) => (
              <article key={entry.id} className="app-card p-4">
                <h2 className="font-semibold">{entry.action}</h2>
                <p className="mt-1 break-all text-sm text-slate-600">
                  {entry.actor?.email ?? 'Unknown actor'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {entry.card?.slug ?? entry.entityId ?? '—'} ·{' '}
                  {new Date(entry.createdAt).toLocaleString()}
                </p>
              </article>
            ))}
          </div>
          <div className="app-card hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-app-background text-xs uppercase tracking-wide text-app-secondary">
                <tr>
                  <th className="p-3">Time</th>
                  <th className="p-3">Actor</th>
                  <th className="p-3">Action</th>
                  <th className="p-3">Card / entity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {logs.data.items.map((entry) => (
                  <tr key={entry.id}>
                    <td className="whitespace-nowrap p-3">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">{entry.actor?.email ?? 'Unknown actor'}</td>
                    <td className="p-3">{entry.action}</td>
                    <td className="p-3">{entry.card?.slug ?? entry.entityId ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">
              {logs.data.total} entries · page {page}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="app-button-secondary disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * logs.data.pageSize >= logs.data.total}
                onClick={() => setPage(page + 1)}
                className="app-button-secondary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
