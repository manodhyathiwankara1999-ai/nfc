'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAdminUsers } from '@/lib/api/admin';
import { ErrorState } from './AdminOverviewPage';

export function AdminUsersPage() {
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(1);
  const users = useQuery({
    queryKey: ['admin', 'users', query, page],
    queryFn: () => getAdminUsers({ query: query || undefined, page, pageSize: 25 }),
  });
  return (
    <section className="space-y-5">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-app-text">Users</h1>
        <p className="mt-2 text-sm text-app-secondary">Read-only account list and card counts.</p>
      </header>
      <label className="block max-w-lg text-sm font-medium">
        Search users
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setPage(1);
          }}
          placeholder="Name or email"
          className="app-control mt-1"
        />
      </label>
      {users.isLoading && <p className="text-sm text-slate-600">Loading users…</p>}
      {users.isError && (
        <ErrorState message="Could not load users." onRetry={() => void users.refetch()} />
      )}
      {users.data && (
        <>
          <div className="app-card hidden overflow-x-auto sm:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-app-background text-xs uppercase tracking-wide text-app-secondary">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Cards</th>
                  <th className="p-3">Joined</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-app-border">
                {users.data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="p-3">{user.name ?? '—'}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">{user.role}</td>
                    <td className="p-3">{user.cardCount}</td>
                    <td className="p-3">{new Date(user.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="grid gap-3 sm:hidden">
            {users.data.items.map((user) => (
              <article key={user.id} className="app-card p-4">
                <h2 className="font-semibold">{user.name ?? 'Unnamed account'}</h2>
                <p className="mt-1 break-all text-sm text-slate-600">{user.email}</p>
                <p className="mt-2 text-xs text-slate-500">
                  {user.role} · {user.cardCount} cards
                </p>
              </article>
            ))}
          </div>
          <Pager
            page={page}
            pageSize={users.data.pageSize}
            total={users.data.total}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}

function Pager({
  page,
  pageSize,
  total,
  onChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-slate-600">
        {total} users · page {page}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
          className="app-button-secondary disabled:opacity-40"
        >
          Previous
        </button>
        <button
          type="button"
          disabled={page * pageSize >= total}
          onClick={() => onChange(page + 1)}
          className="app-button-secondary disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
