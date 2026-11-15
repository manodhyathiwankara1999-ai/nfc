import { redirect } from 'next/navigation';
import { CurrentUserApiError, getCurrentUser } from '@/lib/api/server';
import { AppShell } from '@/components/layout/AppShell';
import { AppTheme } from '@/components/layout/AppTheme';
import { DashboardLoadError } from '@/features/dashboard/components/DashboardLoadError';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;
  try {
    user = await getCurrentUser();
  } catch (error) {
    if (error instanceof CurrentUserApiError) {
      return (
        <AppTheme>
          <DashboardLoadError statusCode={error.statusCode} />
        </AppTheme>
      );
    }
    if (error instanceof TypeError)
      return (
        <AppTheme>
          <DashboardLoadError statusCode={503} />
        </AppTheme>
      );
    return (
      <AppTheme>
        <DashboardLoadError statusCode={500} />
      </AppTheme>
    );
  }
  if (!user) redirect('/login');
  return (
    <AppTheme>
      <AppShell userEmail={user.email}>{children}</AppShell>
    </AppTheme>
  );
}
