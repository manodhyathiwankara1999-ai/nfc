'use client';

import { useState, type FormEvent } from 'react';

export function SuperAdminLoginPage({ next }: { next?: string }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/super-admin/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      if (!response.ok) {
        setError(
          response.status === 429
            ? 'Too many login attempts. Try again later.'
            : 'Invalid username or password.',
        );
        return;
      }
      const destination =
        next?.startsWith('/super-admin') && next !== '/super-admin/login' ? next : '/super-admin';
      window.location.assign(destination);
    } catch {
      setError('Invalid username or password.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-4 py-8">
      <section className="app-card w-full max-w-md p-6 sm:p-8">
        <span
          aria-hidden="true"
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-app-light font-bold text-app-primary"
        >
          N
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Super admin</h1>
        <p className="mt-1 text-sm text-slate-600">Sign in to manage cards and accounts.</p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <form onSubmit={(event) => void submit(event)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <input
              id="username"
              name="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="app-control mt-1"
            />
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="app-control mt-1"
            />
          </div>
          <button type="submit" disabled={submitting} className="app-button-primary w-full">
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
