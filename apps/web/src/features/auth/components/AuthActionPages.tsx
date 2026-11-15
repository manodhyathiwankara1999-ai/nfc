'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { ForgotPasswordSchema } from '@nfc/shared';
import { z } from 'zod';
import { getSupabaseAuthRedirectUrl, getSupabaseBrowserClient } from '@/lib/supabase/client';

function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-app-background px-4 py-8">
      <section className="app-card w-full max-w-md p-6 sm:p-8">
        <span
          aria-hidden="true"
          className="mb-6 flex h-11 w-11 items-center justify-center rounded-xl bg-app-light font-bold text-app-primary"
        >
          N
        </span>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {children}
      </section>
    </main>
  );
}

export function VerifyEmailPage() {
  return (
    <AuthCard title="Verify your email">
      <p className="mt-4 text-sm text-slate-600">
        Follow the verification link sent to your email address. Once verified, you can log in.
      </p>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">
          Continue to login
        </Link>
      </p>
    </AuthCard>
  );
}

export function ForgotPasswordPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const form = useForm<{ email: string }>({ resolver: zodResolver(ForgotPasswordSchema) });

  async function submit(input: { email: string }) {
    setError('');
    try {
      const { error: resetError } = await getSupabaseBrowserClient().auth.resetPasswordForEmail(
        input.email,
        { redirectTo: getSupabaseAuthRedirectUrl('/auth/callback?next=/reset-password') },
      );
      if (resetError) throw resetError;
      setMessage('If an account exists for that email, a password reset link has been sent.');
    } catch {
      setError('Could not send a reset email. Please try again.');
    }
  }

  return (
    <AuthCard title="Reset your password">
      <p className="mt-2 text-sm text-slate-600">Enter the email address for your account.</p>
      {message ? (
        <p role="status" className="mt-4 text-sm text-emerald-700">
          {message}
        </p>
      ) : (
        <form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-4">
          <label className="block text-sm font-medium" htmlFor="email">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            {...form.register('email')}
            className="app-control"
          />
          {form.formState.errors.email && (
            <p className="text-xs text-rose-700">{form.formState.errors.email.message}</p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button disabled={form.formState.isSubmitting} className="app-button-primary w-full">
            Send reset link
          </button>
        </form>
      )}
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-indigo-600 hover:underline">
          Back to login
        </Link>
      </p>
    </AuthCard>
  );
}

const newPasswordSchema = z.object({ password: z.string().min(8) });
type NewPasswordInput = z.infer<typeof newPasswordSchema>;

export function ResetPasswordPage() {
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const form = useForm<NewPasswordInput>({ resolver: zodResolver(newPasswordSchema) });

  async function submit(input: NewPasswordInput) {
    setError('');
    try {
      const { error: updateError } = await getSupabaseBrowserClient().auth.updateUser({
        password: input.password,
      });
      if (updateError) throw updateError;
      setMessage('Your password has been updated. You can continue to your account.');
      form.reset();
    } catch {
      setError('Could not update the password. The reset link may be invalid or expired.');
    }
  }

  return (
    <AuthCard title="Choose a new password">
      {message ? (
        <p role="status" className="mt-4 text-sm text-emerald-700">
          {message}{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      ) : (
        <form onSubmit={form.handleSubmit(submit)} className="mt-5 space-y-4">
          <label className="block text-sm font-medium" htmlFor="password">
            New password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
            className="app-control"
          />
          {form.formState.errors.password && (
            <p className="text-xs text-rose-700">Use at least 8 characters.</p>
          )}
          {error && (
            <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
              {error}
            </p>
          )}
          <button disabled={form.formState.isSubmitting} className="app-button-primary w-full">
            Update password
          </button>
        </form>
      )}
    </AuthCard>
  );
}
