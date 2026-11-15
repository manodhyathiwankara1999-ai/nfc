'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const ADMIN_NAVIGATION = [
  { href: '/super-admin', label: 'Overview' },
  { href: '/super-admin/cards', label: 'Cards' },
  { href: '/super-admin/users', label: 'Users' },
  { href: '/super-admin/audit-logs', label: 'Audit log' },
];

export function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Super admin" className="space-y-1">
      {ADMIN_NAVIGATION.map((item) => {
        const active =
          pathname === item.href ||
          (item.href !== '/super-admin' && pathname.startsWith(`${item.href}/`));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
            className="app-nav-link"
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
