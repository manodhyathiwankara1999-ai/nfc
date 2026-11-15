import ProfileSettingsPage from '@/features/profile/components/ProfileSettingsPage';

export default async function Page({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  return <ProfileSettingsPage searchParams={await searchParams} />;
}
