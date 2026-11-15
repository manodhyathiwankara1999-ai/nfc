import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ToastViewport } from '@/components/layout/ToastViewport';
import { AppTheme } from '@/components/layout/AppTheme';
import { AdminMobileNavDrawer } from '@/components/layout/AdminMobileNavDrawer';
import { AdminNavigation } from '@/components/layout/AdminNavigation';
import { SignOutButton } from '@/components/layout/SignOutButton';
import { CurrentUserApiError, getCurrentUser } from '@/lib/api/server';
import { DashboardLoadError } from '@/features/dashboard/components/DashboardLoadError';

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
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
  if (!user) redirect('/super-admin/login');
  if (user.role !== 'SUPER_ADMIN') redirect('/dashboard?notice=admin-required');

  return (
    <AppTheme>
      <div className="min-h-screen bg-app-background lg:flex">
        <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-app-border bg-white lg:flex">
          <div className="border-b border-app-border px-5 py-5">
            <Link
              href="/super-admin"
              className="flex items-center gap-3 text-base font-semibold tracking-tight"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary text-sm font-bold text-white">
                N
              </span>
              nfc-ecard <span className="text-xs font-medium text-app-muted">admin</span>
            </Link>
            <p className="mt-4 truncate text-xs text-app-secondary">{user.email}</p>
          </div>
          <div className="flex-1 px-3 py-5">
            <AdminNavigation />
          </div>
          <div className="border-t border-app-border p-3">
            <SignOutButton className="app-nav-link w-full text-left" />
          </div>
        </aside>
        <div className="min-w-0 flex-1">
          <header className="sticky top-0 z-30 border-b border-app-border bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
            <div className="flex min-h-11 items-center gap-3">
              <AdminMobileNavDrawer />
              <Link href="/super-admin" className="flex items-center gap-2 font-semibold lg:hidden">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-primary text-xs font-bold text-white">
                  N
                </span>
                Admin
              </Link>
              <div className="hidden min-w-0 flex-1 sm:block">
                <button
                  type="button"
                  disabled
                  aria-label="Search is coming soon"
                  className="flex min-h-10 w-full max-w-md items-center justify-between rounded-xl border border-app-border bg-app-background px-3 text-left text-sm text-app-muted"
                >
                  <span>Search (coming soon)</span>
                  <span className="flex items-center gap-2 text-[10px]">
                    <span>Soon</span>
                    <kbd className="rounded-md border border-app-border bg-white px-2 py-1 font-medium">
                      Ctrl K
                    </kbd>
                  </span>
                </button>
              </div>
              <span className="ml-auto hidden max-w-48 truncate text-sm font-medium text-app-secondary lg:block">
                {user.email}
              </span>
              <button
                type="button"
                disabled
                aria-label="Notifications coming soon"
                title="Notifications coming soon"
                className="app-button-secondary inline-flex min-h-10 min-w-10 items-center justify-center p-0 text-app-secondary"
              >
                <svg
                  aria-hidden="true"
                  viewBox="0 0 24 24"
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                >
                  <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
                </svg>
              </button>
            </div>
          </header>
          <main className="mx-auto max-w-[1600px] px-4 py-6 pb-12 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </main>
        </div>
        <ToastViewport />
      </div>
    </AppTheme>
  );
}
