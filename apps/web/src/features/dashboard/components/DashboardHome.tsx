'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { getMyCards } from '@/lib/api/cards';
import { CARDS_QUERY_KEY, formatPurpose, StatusBadge } from './CardNavigation';

export default function DashboardHome() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('card');
  const notice = searchParams.get('notice');
  const cards = useQuery({ queryKey: CARDS_QUERY_KEY, queryFn: getMyCards });
  if (cards.isLoading) return <p className="text-sm text-app-secondary">Loading your cards…</p>;
  if (cards.isError) {
    return (
      <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
        <p>Could not load your dashboard.</p>
        <button type="button" onClick={() => void cards.refetch()} className="mt-2 underline">
          Retry
        </button>
      </div>
    );
  }
  const list = cards.data ?? [];
  const card = list.find((item) => item.id === selectedId) ?? list[0];
  if (!card) {
    return (
      <main className="app-card app-card-dashed mx-auto max-w-3xl p-8 text-center sm:p-12">
        <span
          aria-hidden="true"
          className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-app-light text-xl font-bold text-app-primary"
        >
          N
        </span>
        <h1 className="mt-5 text-2xl font-bold tracking-tight">Welcome to your card dashboard</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm text-app-secondary">
          You do not have a card yet. Once one is added to your account, customize its profile and
          share your public link here.
        </p>
        <Link
          href="/dashboard/account"
          className="app-button-secondary mt-5 inline-flex items-center"
        >
          Manage account
        </Link>
      </main>
    );
  }

  const publicUrl = `/u/${encodeURIComponent(card.slug)}`;
  const qrUrl = `/api/v1/public/cards/${encodeURIComponent(card.slug)}/download/qr`;
  return (
    <div className="mx-auto max-w-6xl space-y-7">
      {notice && (
        <p
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
        >
          {notice === 'card-unavailable'
            ? 'That card is no longer available. Choose one of your cards to continue.'
            : notice === 'admin-required'
              ? 'Super admin access is required to open that page.'
              : 'Your account could not be updated. Please check your account and try again.'}
        </p>
      )}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-app-text sm:text-4xl">
              {card.profile.fullName}
            </h1>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-2 text-sm text-app-secondary">
            {formatPurpose(card.purpose)} card ·{' '}
            {card.status === 'ACTIVE' ? 'Public profile is live.' : 'Public profile is inactive.'}
          </p>
        </div>
        <Link
          href={`/dashboard/profile?card=${encodeURIComponent(card.id)}`}
          className="app-button-primary inline-flex items-center justify-center"
        >
          Customize this card
        </Link>
      </header>

      <section
        aria-label="Selected card overview"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <InfoTile label="Purpose" value={formatPurpose(card.purpose)} />
        <InfoTile label="Status" value={card.status.toLowerCase()} />
        <InfoTile label="Public profile" value={`/u/${card.slug}`} href={publicUrl} />
        <InfoTile label="Products or services" value={`${card.products.length} / 5`} />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <Link
          href={publicUrl}
          target="_blank"
          className="app-card app-card-interactive flex min-h-24 items-center justify-between p-5 font-semibold"
        >
          <span>
            <span className="block">View public profile</span>
            <span className="mt-1 block break-all text-xs font-normal text-slate-500">
              {publicUrl}
            </span>
          </span>
          <span aria-hidden="true">↗</span>
        </Link>
        {card.status === 'ACTIVE' ? (
          <a
            href={qrUrl}
            download
            className="app-card app-card-interactive flex min-h-24 items-center justify-between gap-4 p-5 font-semibold"
          >
            <span>Download this card’s QR code</span>
            <Image
              src={qrUrl}
              width={88}
              height={88}
              unoptimized
              alt={`QR code for ${card.profile.fullName}'s card`}
            />
          </a>
        ) : (
          <div className="app-card flex min-h-24 items-center p-5 text-sm text-app-secondary">
            QR downloads are available when the card is active.
          </div>
        )}
      </section>

      {list.length > 1 && (
        <section className="app-card p-5 sm:p-6">
          <h2 className="font-semibold">Other cards</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {list
              .filter((item) => item.id !== card.id)
              .map((item) => (
                <li key={item.id} className="flex min-h-14 items-center justify-between gap-3 py-2">
                  <span className="truncate font-medium">{item.profile.fullName}</span>
                  <Link
                    href={`/dashboard?card=${encodeURIComponent(item.id)}`}
                    className="text-sm font-semibold text-indigo-700"
                  >
                    Select
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function InfoTile({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="app-card min-h-24 p-5">
      <p className="text-sm text-app-secondary">{label}</p>
      {href ? (
        <Link
          href={href}
          target="_blank"
          className="mt-2 block break-all font-mono text-sm underline"
        >
          {value}
        </Link>
      ) : (
        <p className="mt-2 font-semibold capitalize">{value}</p>
      )}
    </div>
  );
}
