import Link from 'next/link';
import { Suspense } from 'react';
import { AppNavigation } from './AppNavigation';
import { MobileNavDrawer } from './MobileNavDrawer';
import { SignOutButton } from './SignOutButton';
import { CardNavigation } from '@/features/dashboard/components/CardNavigation';
import { ToastViewport } from './ToastViewport';

export function AppShell({
  children,
  userEmail,
}: {
  children: React.ReactNode;
  userEmail: string;
}) {
  return (
    <div className="min-h-screen bg-app-background lg:flex">
      <aside className="sticky top-0 hidden h-screen shrink-0 border-r border-app-border bg-app-sidebar lg:flex lg:w-64 lg:flex-col">
        <div className="border-b border-app-border px-5 py-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3 text-base font-semibold tracking-tight text-app-text"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary text-sm font-bold text-white">
              N
            </span>
            nfc-ecard
          </Link>
          <div className="mt-5 flex min-w-0 items-center gap-3 rounded-xl bg-app-background p-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-light text-sm font-semibold text-app-primary"
            >
              {userEmail.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <span className="block text-xs font-medium text-app-muted">Signed in as</span>
              <span className="block truncate text-xs font-semibold text-app-text-secondary">
                {userEmail}
              </span>
            </span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-5">
          <AppNavigation />
          <div className="mt-5 border-t border-app-border pt-4">
            <Suspense
              fallback={<div className="px-3 py-2 text-sm text-app-muted">Loading cards…</div>}
            >
              <CardNavigation />
            </Suspense>
          </div>
        </div>
        <div className="border-t border-app-border p-3">
          <SignOutButton className="app-nav-link w-full text-left" />
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <header className="sticky top-0 z-30 border-b border-app-border bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 lg:px-8">
          <div className="flex min-h-11 items-center gap-3">
            <MobileNavDrawer />
            <Link
              href="/dashboard"
              className="flex shrink-0 items-center gap-2 font-semibold tracking-tight text-app-text lg:hidden"
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-app-primary text-xs font-bold text-white">
                N
              </span>
              nfc-ecard
            </Link>
            <div className="hidden min-w-0 flex-1 sm:block">
              <button
                type="button"
                disabled
                aria-label="Search is coming soon"
                className="flex min-h-10 w-full max-w-md items-center justify-between rounded-xl border border-app-border bg-app-background px-3 text-left text-sm text-app-muted"
              >
                <span>Search (coming soon)</span>
                <span className="flex items-center gap-2">
                  <span className="text-[10px]">Soon</span>
                  <kbd className="rounded-md border border-app-border bg-white px-2 py-1 text-[10px] font-medium">
                    Ctrl K
                  </kbd>
                </span>
              </button>
            </div>
            <div className="ml-auto flex items-center gap-2">
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
              <span className="hidden max-w-48 truncate text-sm font-medium text-app-secondary lg:block">
                {userEmail}
              </span>
              <span className="hidden h-9 w-9 items-center justify-center rounded-full bg-app-light text-sm font-semibold text-app-primary lg:flex">
                {userEmail.slice(0, 1).toUpperCase()}
              </span>
            </div>
          </div>
          <div className="mt-3 sm:hidden">
            <button
              type="button"
              disabled
              aria-label="Search is coming soon"
              className="flex min-h-10 w-full items-center justify-between rounded-xl border border-app-border bg-app-background px-3 text-sm text-app-muted"
            >
              <span>Search (coming soon)</span>
              <kbd className="rounded-md border border-app-border bg-white px-2 py-1 text-[10px] font-medium">
                Ctrl K
              </kbd>
            </button>
          </div>
        </header>
        <div className="border-b border-app-border bg-white lg:hidden">
          <Suspense fallback={<div className="p-3 text-sm text-app-muted">Loading cards…</div>}>
            <CardNavigation />
          </Suspense>
        </div>
        <main className="mx-auto w-full max-w-[1600px] px-4 py-6 pb-12 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
      <ToastViewport />
    </div>
  );
}
