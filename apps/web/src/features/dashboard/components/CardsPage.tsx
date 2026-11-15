'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getMyCards, setCardStatus, type UserCard } from '@/lib/api/cards';
import { CARDS_QUERY_KEY, formatPurpose, StatusBadge } from './CardNavigation';

export function CardsPage() {
  const searchParams = useSearchParams();
  const selectedId = searchParams.get('card');
  const queryClient = useQueryClient();
  const router = useRouter();
  const cards = useQuery({ queryKey: CARDS_QUERY_KEY, queryFn: getMyCards });
  const updateStatus = useMutation({
    mutationFn: ({
      cardId,
      status,
    }: {
      cardId: string;
      status: 'ACTIVE' | 'INACTIVE' | 'DELETED';
    }) => setCardStatus(cardId, status),
    onMutate: async ({ cardId, status }) => {
      await queryClient.cancelQueries({ queryKey: CARDS_QUERY_KEY });
      const previousCards = queryClient.getQueryData<UserCard[]>(CARDS_QUERY_KEY);
      queryClient.setQueryData<UserCard[]>(CARDS_QUERY_KEY, (current) =>
        status === 'DELETED'
          ? current?.filter((card) => card.id !== cardId)
          : current?.map((card) => (card.id === cardId ? { ...card, status } : card)),
      );
      return { previousCards };
    },
    onSuccess: (_result, variables) => {
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message:
              variables.status === 'DELETED'
                ? 'Card deleted'
                : variables.status === 'ACTIVE'
                  ? 'Card activated'
                  : 'Card deactivated',
            tone: 'success',
          },
        }),
      );
      if (variables.status === 'DELETED') {
        const remaining = queryClient
          .getQueryData<UserCard[]>(CARDS_QUERY_KEY)
          ?.filter((card) => card.id !== variables.cardId);
        if (remaining?.length) {
          const params = new URLSearchParams(searchParams.toString());
          params.set('card', remaining[0].id);
          router.replace(`/dashboard/cards?${params}`);
        } else {
          router.replace('/dashboard/cards');
        }
      }
    },
    onError: (error, _variables, context) => {
      if (context?.previousCards) {
        queryClient.setQueryData(CARDS_QUERY_KEY, context.previousCards);
      }
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message: error instanceof Error ? error.message : 'Could not update the card.',
            tone: 'error',
          },
        }),
      );
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
    },
  });

  if (cards.isLoading) return <p className="text-sm text-app-secondary">Loading cards…</p>;
  if (cards.isError) {
    return (
      <ErrorNotice message="Could not load your cards." onRetry={() => void cards.refetch()} />
    );
  }
  const list = cards.data ?? [];
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-app-text">Your cards</h1>
        <p className="mt-2 text-sm text-app-secondary">
          Each card has its own public profile and status.
        </p>
      </header>

      {updateStatus.isError && (
        <ErrorNotice
          message={
            updateStatus.error instanceof Error
              ? updateStatus.error.message
              : 'Could not update the card.'
          }
          onRetry={() => {
            if (updateStatus.variables) updateStatus.mutate(updateStatus.variables);
          }}
        />
      )}
      {list.length === 0 ? (
        <section className="app-card app-card-dashed p-8 text-center sm:p-10">
          <h2 className="text-lg font-semibold">No cards yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            When a card is added to your account, you can customize its profile here.
          </p>
          <Link
            href="/dashboard/account"
            className="app-button-secondary mt-5 inline-flex items-center"
          >
            View account details
          </Link>
        </section>
      ) : (
        <div className="grid gap-4">
          {list.map((card) => (
            <CardManagementItem
              key={card.id}
              card={card}
              selected={card.id === selectedId}
              busy={updateStatus.isPending && updateStatus.variables?.cardId === card.id}
              onChangeStatus={(status) => {
                const publicEffect =
                  status === 'ACTIVE'
                    ? 'This makes the full profile publicly visible.'
                    : status === 'INACTIVE'
                      ? 'The public page will show only the card name and inactive status.'
                      : 'The public page and downloads will return not found. The card will be soft-deleted and can be restored by support.';
                if (window.confirm(`${publicEffect}\n\nContinue?`)) {
                  updateStatus.mutate({ cardId: card.id, status });
                }
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function CardManagementItem({
  card,
  selected,
  busy,
  onChangeStatus,
}: {
  card: UserCard;
  selected: boolean;
  busy: boolean;
  onChangeStatus: (status: 'ACTIVE' | 'INACTIVE' | 'DELETED') => void;
}) {
  const publicUrl = `/u/${encodeURIComponent(card.slug)}`;
  const qrUrl = `/api/v1/public/cards/${encodeURIComponent(card.slug)}/download/qr`;
  return (
    <article className={`app-card p-5 sm:p-6 ${selected ? 'app-card-selected' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">{card.profile.fullName}</h2>
            <StatusBadge status={card.status} />
          </div>
          <p className="mt-1 text-sm text-slate-500">{formatPurpose(card.purpose)}</p>
          <p className="mt-2 break-all font-mono text-xs text-slate-500">/u/{card.slug}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/dashboard/profile?card=${encodeURIComponent(card.id)}`}
            className="app-button-primary inline-flex items-center"
          >
            Customize
          </Link>
          <Link
            href={publicUrl}
            target="_blank"
            className="app-button-secondary inline-flex items-center"
          >
            Preview
          </Link>
          {card.status === 'ACTIVE' && (
            <a
              href={qrUrl}
              download
              className="app-button-secondary inline-flex items-center gap-2 px-3"
            >
              <Image src={qrUrl} width={40} height={40} unoptimized alt="" />
              Download QR
            </a>
          )}
        </div>
      </div>
      <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
        {card.status === 'ACTIVE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeStatus('INACTIVE')}
            className="app-button-secondary border-amber-200 text-amber-800 disabled:opacity-50"
          >
            Deactivate
          </button>
        )}
        {card.status === 'INACTIVE' && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeStatus('ACTIVE')}
            className="app-button-secondary border-emerald-200 text-emerald-800 disabled:opacity-50"
          >
            Activate
          </button>
        )}
        {(card.status === 'ACTIVE' || card.status === 'INACTIVE') && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChangeStatus('DELETED')}
            className="min-h-11 rounded-lg border border-rose-200 bg-white px-4 text-sm font-semibold text-rose-700 disabled:opacity-50"
          >
            Delete card
          </button>
        )}
      </div>
    </article>
  );
}

function ErrorNotice({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-rose-50 p-4 text-sm text-rose-800"
    >
      <span>{message}</span>
      <button
        type="button"
        onClick={onRetry}
        className="min-h-11 rounded-lg border border-rose-300 px-4 font-semibold"
      >
        Retry
      </button>
    </div>
  );
}
