import { RegisterPage } from '@/features/auth/components/RegisterPage';

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  return <RegisterPage searchParams={await searchParams} />;
}
