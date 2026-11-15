import { getSupabaseAuthRedirectUrl, getSupabaseBrowserClient } from '@/lib/supabase/client';

export async function resendSignupVerification(email: string): Promise<void> {
  const { error } = await getSupabaseBrowserClient().auth.resend({
    type: 'signup',
    email,
    options: { emailRedirectTo: getSupabaseAuthRedirectUrl('/auth/callback') },
  });
  if (error) throw error;
}
