'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LoginSchema, type LoginInput } from '@nfc/shared';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { resendSignupVerification } from '@/features/auth/api/resend-verification';

function safeRedirectPath(next: string | undefined): string {
  if (!next) return '/dashboard';
  try {
    const destination = new URL(next, window.location.origin);
    if (destination.origin !== window.location.origin) return '/dashboard';
    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return '/dashboard';
  }
}

function getInitialLoginError(searchParams: { error?: string; auth_error?: string }): string {
  if (searchParams.error === 'auth_callback') {
    return 'That email link is invalid or expired. Request a new link and try again.';
  }
  if (searchParams.auth_error === 'auth_unavailable') {
    return 'The authentication service is temporarily unavailable. Check your connection and try again.';
  }
  if (searchParams.auth_error === 'missing_session') {
    return 'No active login session was found. Log in to continue. If this keeps happening after you log in, check that cookies are enabled.';
  }
  return '';
}

export function LoginPage({
  searchParams,
}: {
  searchParams: {
    error?: string;
    verified?: string;
    next?: string;
    auth_error?: string;
  };
}) {
  const [error, setError] = useState(() => getInitialLoginError(searchParams));
  const [unverifiedEmail, setUnverifiedEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const form = useForm<LoginInput>({ resolver: zodResolver(LoginSchema) });

  async function submit(input: LoginInput) {
    setError('');
    setUnverifiedEmail('');
    setResendMessage('');
    setResendError('');
    try {
      const { error: signInError } =
        await getSupabaseBrowserClient().auth.signInWithPassword(input);
      if (signInError) {
        const isEmailUnverified =
          signInError.code === 'email_not_confirmed' ||
          signInError.message.toLowerCase().includes('not confirmed');
        setError(
          isEmailUnverified
            ? 'Please verify your email before logging in.'
            : 'Invalid email or password.',
        );
        if (isEmailUnverified) setUnverifiedEmail(input.email);
        return;
      }
      window.location.assign(safeRedirectPath(searchParams.next));
    } catch {
      setError('Could not reach the authentication service. Check your connection and try again.');
    }
  }

  async function resendVerification() {
    setIsResending(true);
    setResendMessage('');
    setResendError('');
    try {
      await resendSignupVerification(unverifiedEmail);
      setResendMessage(
        'If this address still needs verification, a new link has been requested. Check your inbox and spam folder.',
      );
    } catch {
      setResendError('Could not resend the verification email. Please try again shortly.');
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-app-background px-4 py-8">
      <div className="app-card w-full max-w-md p-6 sm:p-8">
        <span
          aria-hidden="true"
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-app-light font-bold text-app-primary"
        >
          N
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
        <p className="mt-1 text-sm text-slate-600">Log in to manage your card.</p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {unverifiedEmail && (
          <div className="mt-3 space-y-2">
            <button
              type="button"
              onClick={resendVerification}
              disabled={isResending}
              className="w-full rounded-lg border border-indigo-200 px-3 py-2 text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-60"
            >
              {isResending ? 'Sending…' : 'Resend verification email'}
            </button>
            {resendMessage && (
              <p role="status" className="text-sm text-emerald-700">
                {resendMessage}
              </p>
            )}
            {resendError && (
              <p role="alert" className="text-sm text-rose-700">
                {resendError}
              </p>
            )}
          </div>
        )}
        {searchParams.verified && (
          <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            Email verified. You can now log in.
          </p>
        )}

        <form onSubmit={form.handleSubmit(submit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
              className="app-control mt-1"
            />
            {form.formState.errors.email && (
              <p className="mt-1 text-xs text-rose-700">{form.formState.errors.email.message}</p>
            )}
          </div>
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              {...form.register('password')}
              className="app-control mt-1"
            />
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-rose-700">{form.formState.errors.password.message}</p>
            )}
          </div>
          <div className="text-right">
            <Link
              href="/forgot-password"
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="app-button-primary w-full"
          >
            {form.formState.isSubmitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          No account?{' '}
          <Link href="/register" className="font-medium text-indigo-600 hover:underline">
            Sign up free
          </Link>
        </p>
      </div>
    </div>
  );
}
