'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { RegisterSchema, RegistrationAccountType, type RegisterInput } from '@nfc/shared';
import { getSupabaseAuthRedirectUrl, getSupabaseBrowserClient } from '@/lib/supabase/client';
import { resendSignupVerification } from '@/features/auth/api/resend-verification';

export function RegisterPage({ searchParams }: { searchParams: { error?: string } }) {
  const [message, setMessage] = useState('');
  const [error, setError] = useState(searchParams.error ?? '');
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState('');
  const [resendMessage, setResendMessage] = useState('');
  const [resendError, setResendError] = useState('');
  const [isResending, setIsResending] = useState(false);
  const form = useForm<RegisterInput>({
    resolver: zodResolver(RegisterSchema),
    defaultValues: { accountType: RegistrationAccountType.SELF_EMPLOYED },
  });

  async function submit(input: RegisterInput) {
    setError('');
    setMessage('');
    try {
      const { data, error: signUpError } = await getSupabaseBrowserClient().auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: { full_name: input.displayName, account_type: input.accountType },
          emailRedirectTo: getSupabaseAuthRedirectUrl('/auth/callback'),
        },
      });
      if (signUpError) {
        if (signUpError.code === 'user_already_exists') {
          setMessage('If an account exists for this email, log in or request a password reset.');
          return;
        }
        setError(signUpError.message);
        return;
      }

      if (data.session) {
        window.location.assign('/dashboard');
        return;
      }
      setPendingVerificationEmail(input.email);
      setMessage(
        `Your account is ready. Check ${input.email} for a verification link to continue.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not connect to the authentication service.',
      );
    }
  }

  async function resendVerification() {
    setIsResending(true);
    setResendMessage('');
    setResendError('');
    try {
      await resendSignupVerification(pendingVerificationEmail);
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
        <h1 className="text-2xl font-bold tracking-tight">Create your card</h1>
        <p className="mt-1 text-sm text-slate-600">Free profile, ready in a minute.</p>
        {error && (
          <p role="alert" className="mt-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        {message && (
          <p role="status" className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">
            {message}
          </p>
        )}
        {pendingVerificationEmail && (
          <div className="mt-4 space-y-3">
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

        <form onSubmit={form.handleSubmit(submit)} className="mt-6 space-y-4">
          <div>
            <label htmlFor="displayName" className="text-sm font-medium">
              Full name
            </label>
            <input
              id="displayName"
              autoComplete="name"
              {...form.register('displayName')}
              className="app-control mt-1"
            />
            {form.formState.errors.displayName && (
              <p className="mt-1 text-xs text-rose-700">
                {form.formState.errors.displayName.message}
              </p>
            )}
          </div>
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
              autoComplete="new-password"
              {...form.register('password')}
              className="app-control mt-1"
            />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters.</p>
            {form.formState.errors.password && (
              <p className="mt-1 text-xs text-rose-700">{form.formState.errors.password.message}</p>
            )}
          </div>
          <fieldset>
            <legend className="text-sm font-medium">Account type</legend>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-slate-300 p-3 text-sm">
                <input
                  type="radio"
                  value={RegistrationAccountType.SELF_EMPLOYED}
                  {...form.register('accountType')}
                />
                Self-employed
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-slate-300 p-3 text-sm">
                <input
                  type="radio"
                  value={RegistrationAccountType.COMPANY}
                  {...form.register('accountType')}
                />
                Company
              </label>
            </div>
          </fieldset>
          <button
            type="submit"
            disabled={form.formState.isSubmitting}
            className="app-button-primary w-full"
          >
            {form.formState.isSubmitting ? 'Creating account…' : 'Sign up'}
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600">
          Already have an account?{' '}
          <Link href="/login" className="font-medium text-indigo-600 hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
