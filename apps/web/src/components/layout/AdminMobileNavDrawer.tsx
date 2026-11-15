'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import { AdminNavigation } from './AdminNavigation';
import { SignOutButton } from './SignOutButton';

export function AdminMobileNavDrawer() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);

  function closeDrawer() {
    if (dialogRef.current?.open) dialogRef.current.close();
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        aria-label="Open admin navigation menu"
        aria-expanded={open}
        aria-controls="admin-navigation-drawer"
        onClick={() => {
          if (dialogRef.current && !dialogRef.current.open) {
            dialogRef.current.showModal();
            setOpen(true);
          }
        }}
        className="app-button-secondary inline-flex min-h-11 min-w-11 items-center justify-center p-0 lg:hidden"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        >
          <path d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>
      <dialog
        ref={dialogRef}
        id="admin-navigation-drawer"
        aria-label="Super admin navigation"
        aria-modal="true"
        onClose={() => setOpen(false)}
        onCancel={(event) => {
          event.preventDefault();
          closeDrawer();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            event.preventDefault();
            closeDrawer();
          }
        }}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-[min(88vw,20rem)] max-w-none border-0 bg-transparent p-0 text-app-text backdrop:bg-slate-950/40"
      >
        <div className="flex h-full flex-col border-r border-app-border bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-app-border px-5 py-4">
            <Link
              href="/super-admin"
              onClick={closeDrawer}
              className="flex items-center gap-3 font-semibold"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-primary text-sm font-bold text-white">
                N
              </span>
              Super admin
            </Link>
            <button
              type="button"
              autoFocus
              onClick={closeDrawer}
              aria-label="Close admin navigation menu"
              className="app-button-secondary min-h-10 min-w-10 p-0 text-lg"
            >
              ×
            </button>
          </div>
          <div className="flex-1 p-3">
            <AdminNavigation onNavigate={closeDrawer} />
          </div>
          <div className="border-t border-app-border p-3">
            <SignOutButton className="app-nav-link w-full text-left" />
          </div>
        </div>
      </dialog>
    </>
  );
}
