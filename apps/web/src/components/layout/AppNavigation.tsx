'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavIconName = 'overview' | 'edit' | 'cards' | 'account';

const navigation: { href: string; label: string; icon: NavIconName }[] = [
  { href: '/dashboard', label: 'Overview', icon: 'overview' },
  { href: '/dashboard/profile', label: 'Customize card', icon: 'edit' },
  { href: '/dashboard/cards', label: 'Manage cards', icon: 'cards' },
  { href: '/dashboard/account', label: 'Account', icon: 'account' },
];

export function AppNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Dashboard" className="space-y-1">
      {navigation.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/dashboard' && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className="app-nav-link"
          >
            <NavIcon name={item.icon} />
            {item.label}
          </Link>
        );
      })}
      <div className="space-y-1 border-t border-app-border pt-3">
        <span
          className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm text-app-muted"
          aria-disabled="true"
        >
          <span>Subscription</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide">Soon</span>
        </span>
        <span
          className="flex min-h-11 items-center justify-between gap-2 rounded-xl px-3 text-sm text-app-muted"
          aria-disabled="true"
        >
          <span>Help and support</span>
          <span className="text-[10px] font-semibold uppercase tracking-wide">Soon</span>
        </span>
      </div>
    </nav>
  );
}

function NavIcon({ name }: { name: NavIconName }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {name === 'overview' && (
        <>
          <rect x="4" y="4" width="6" height="6" rx="1" />
          <rect x="14" y="4" width="6" height="6" rx="1" />
          <rect x="4" y="14" width="6" height="6" rx="1" />
          <rect x="14" y="14" width="6" height="6" rx="1" />
        </>
      )}
      {name === 'edit' && (
        <>
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
        </>
      )}
      {name === 'cards' && (
        <>
          <rect x="4" y="5" width="14" height="15" rx="2" />
          <path d="M8 3h12v14M8 10h6M8 14h6" />
        </>
      )}
      {name === 'account' && (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20a7 7 0 0 1 14 0" />
        </>
      )}
    </svg>
  );
}
