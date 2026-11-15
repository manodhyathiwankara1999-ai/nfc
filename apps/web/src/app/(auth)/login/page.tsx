import { LoginPage } from '@/features/auth/components/LoginPage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; registered?: string; next?: string }>;
}) {
  return <LoginPage searchParams={await searchParams} />;
}
