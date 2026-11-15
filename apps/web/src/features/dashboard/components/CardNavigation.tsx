'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMyCards } from '@/lib/api/cards';

export const CARDS_QUERY_KEY = ['cards', 'me'];

export function CardNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('card');
  const [orderOpen, setOrderOpen] = useState(false);
  const cards = useQuery({ queryKey: CARDS_QUERY_KEY, queryFn: getMyCards });
  const selected = cards.data?.find((card) => card.id === selectedId);

  const chooseCard = useCallback(
    (cardId: string) => {
      const dirtyCardId = window.sessionStorage.getItem('card-profile-dirty-card');
      if (
        dirtyCardId &&
        dirtyCardId !== cardId &&
        !window.confirm(
          'You have unsaved changes on another card. Switch cards and keep the draft?',
        )
      ) {
        return;
      }
      const params = new URLSearchParams(searchParams.toString());
      params.set('card', cardId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    if (!cards.data) return;
    if (cards.data.length === 0) {
      if (selectedId) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('card');
        router.replace(`${pathname}${params.size ? `?${params}` : ''}`, { scroll: false });
      }
      return;
    }
    if (!selected) chooseCard(cards.data[0].id);
  }, [cards.data, chooseCard, pathname, router, searchParams, selected, selectedId]);

  return (
    <>
      <section className="border-b border-app-border bg-white p-3 lg:border-0 lg:bg-transparent lg:px-3">
        <div className="flex items-center justify-between gap-2 lg:block">
          <label className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-app-secondary lg:hidden">
            Selected card
            <select
              aria-label="Select card"
              value={selectedId ?? ''}
              onChange={(event) => chooseCard(event.target.value)}
              className="app-control mt-1 font-medium normal-case tracking-normal lg:hidden"
            >
              <option value="" disabled>
                {cards.isLoading ? 'Loading cards…' : 'Choose a card'}
              </option>
              {(cards.data ?? []).map((card) => (
                <option key={card.id} value={card.id}>
                  {card.profile.fullName} · {formatPurpose(card.purpose)} ·{' '}
                  {card.status.toLowerCase()}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setOrderOpen(true)}
            className="app-button-secondary min-h-11 shrink-0 border-app-primary-border px-3 text-xs text-app-hover lg:mt-2 lg:w-full lg:text-sm"
          >
            Order a new card
          </button>
        </div>
        {cards.isError && (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            Could not load your cards.
          </p>
        )}
        {selected && (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-app-background px-3 py-2 text-sm lg:hidden">
            <span className="truncate font-medium">{selected.profile.fullName}</span>
            <StatusBadge status={selected.status} />
          </div>
        )}
        <nav aria-label="Your cards" className="mt-3 hidden space-y-1 lg:block">
          {cards.data?.map((card) => (
            <button
              key={card.id}
              type="button"
              onClick={() => chooseCard(card.id)}
              aria-current={card.id === selectedId ? 'true' : undefined}
              className={`w-full rounded-xl border p-3 text-left transition ${
                card.id === selectedId
                  ? 'border-app-primary-border bg-app-selected'
                  : 'border-transparent bg-white hover:border-app-border hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-slate-900">
                  {card.profile.fullName}
                </span>
                <StatusBadge status={card.status} />
              </span>
              <span className="mt-1 block truncate text-xs text-slate-500">
                {formatPurpose(card.purpose)}
              </span>
            </button>
          ))}
          {cards.data?.length === 0 && (
            <p className="rounded-xl bg-white p-3 text-sm text-app-secondary">No cards yet</p>
          )}
        </nav>
      </section>

      {orderOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOrderOpen(false);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="order-coming-soon-title"
            className="app-card w-full max-w-sm p-6"
          >
            <h2 id="order-coming-soon-title" className="text-xl font-bold">
              Coming soon
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Ordering physical cards will be available soon. Your existing cards are ready to
              manage.
            </p>
            <button
              type="button"
              autoFocus
              onClick={() => setOrderOpen(false)}
              className="app-button-primary mt-5 w-full"
            >
              Got it
            </button>
          </section>
        </div>
      )}
    </>
  );
}

export function formatPurpose(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export function StatusBadge({ status }: { status: string }) {
  const palette =
    status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'INACTIVE'
        ? 'bg-slate-100 text-slate-700'
        : 'bg-rose-100 text-rose-800';
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${palette}`}
    >
      {status.toLowerCase()}
    </span>
  );
}
