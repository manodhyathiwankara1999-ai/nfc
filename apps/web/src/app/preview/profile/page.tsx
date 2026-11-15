import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { ProfilePreviewReceiver } from '@/features/profile/components/ProfilePreviewReceiver';
import { getSupabaseServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Profile preview',
  robots: { index: false, follow: false },
};
export const dynamic = 'force-dynamic';

export default async function ProfilePreviewPage() {
  const supabase = await getSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    redirect('/login?next=%2Fdashboard%2Fprofile&auth_error=missing_session');
  }
  return <ProfilePreviewReceiver />;
}
