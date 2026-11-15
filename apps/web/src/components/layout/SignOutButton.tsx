'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function SignOutButton({ className }: { className?: string }) {
  const router = useRouter();
  const [error, setError] = useState('');

  async function signOut() {
    setError('');
    try {
      const { error: signOutError } = await getSupabaseBrowserClient().auth.signOut();
      if (signOutError) throw signOutError;
      router.replace('/login');
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not sign out. Please try again.');
    }
  }

  return (
    <div>
      <button type="button" onClick={signOut} className={className}>
        Sign out
      </button>
      {error && (
        <p role="alert" className="px-3 pt-1 text-xs text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}
