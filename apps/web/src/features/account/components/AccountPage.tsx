'use client';

import { AccountDetailsUpdateSchema } from '@nfc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api/client';
import { getMyAccount, updateMyAccount } from '@/lib/api/account';

const ACCOUNT_QUERY_KEY = ['account', 'me'];
const inputClass = 'app-control mt-1';

export function AccountPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const account = useQuery({ queryKey: ACCOUNT_QUERY_KEY, queryFn: getMyAccount });
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');
  const update = useMutation({
    mutationFn: updateMyAccount,
    onSuccess: async (value) => {
      queryClient.setQueryData(ACCOUNT_QUERY_KEY, value);
      setName(value.name ?? '');
      setPhone(value.phone ?? '');
      setFeedback('Account details saved.');
      setError('');
    },
  });

  useEffect(() => {
    if (account.data) {
      setName(account.data.name ?? '');
      setPhone(account.data.phone ?? '');
    }
  }, [account.data]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback('');
    setError('');
    const parsed = AccountDetailsUpdateSchema.safeParse({ name, phone });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? 'Please check the highlighted fields.');
      return;
    }
    try {
      await update.mutateAsync(parsed.data);
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 401) {
        router.replace(`/login?next=${encodeURIComponent('/dashboard/account')}`);
        return;
      }
      if (cause instanceof ApiError && [403, 404].includes(cause.statusCode)) {
        router.replace('/dashboard?notice=account-unavailable');
        return;
      }
      setError(cause instanceof Error ? cause.message : 'Could not save your account details.');
    }
  }

  if (account.isLoading) return <p className="text-sm text-slate-600">Loading account…</p>;
  if (account.isError || !account.data) {
    return (
      <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p>Could not load your account details.</p>
        <button type="button" onClick={() => void account.refetch()} className="mt-2 underline">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-app-text">Account</h1>
        <p className="mt-2 text-sm text-app-secondary">
          These details belong to your account. Saved card profiles are managed separately.
        </p>
      </header>
      <form onSubmit={submit} className="app-card space-y-5 p-5 sm:p-7">
        <label className="block text-sm font-medium">
          Name
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={100}
            autoComplete="name"
            className={inputClass}
            required
          />
        </label>
        <label className="block text-sm font-medium">
          Email
          <input
            value={account.data.email}
            readOnly
            className={`${inputClass} bg-slate-50 text-app-secondary`}
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">
            Email changes are managed through Supabase Auth verification.
          </span>
        </label>
        <label className="block text-sm font-medium">
          Phone
          <input
            type="tel"
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
            placeholder="+94771234567"
            maxLength={16}
            className={inputClass}
          />
        </label>
        <p className="rounded-lg bg-indigo-50 p-3 text-sm text-indigo-900">
          Updating account details does not overwrite your cards. Each card profile has its own
          saved name and contact details.
        </p>
        {feedback && (
          <p role="status" className="text-sm text-emerald-700">
            {feedback}
          </p>
        )}
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        <button type="submit" disabled={update.isPending} className="app-button-primary px-5">
          {update.isPending ? 'Saving…' : 'Save account'}
        </button>
      </form>
    </div>
  );
}
