import { SuperAdminLoginPage } from '@/features/auth/components/SuperAdminLoginPage';

export default async function Page({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  return <SuperAdminLoginPage next={(await searchParams).next} />;
}
