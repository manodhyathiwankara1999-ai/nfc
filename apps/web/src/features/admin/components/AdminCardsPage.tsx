'use client';

import { useState, type FormEvent } from 'react';
import {
  CARD_PURPOSES,
  CardDataSchema,
  CardOfficeSchema,
  CardProfileDataSchema,
  CardProductsSchema,
  type CardData,
  type CardOffice,
  type CardProfileData,
  type CardPurpose,
} from '@nfc/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UserCard } from '@/lib/api/cards';
import { ProfileTemplatePicker } from '@/features/profile/components/ProfileTemplatePicker';
import {
  createAdminCard,
  getAdminCards,
  getAdminUsers,
  setAdminCardStatus,
  updateAdminCard,
} from '@/lib/api/admin';
import { ErrorState } from './AdminOverviewPage';

type ProductDraft = {
  image: string;
  name: string;
  price: string;
  currency: string;
  detail: string;
};
const SOCIALS = [
  ['WEBSITE', 'Other website'],
  ['LINKEDIN', 'LinkedIn'],
  ['GITHUB', 'GitHub'],
  ['INSTAGRAM', 'Instagram'],
  ['FACEBOOK', 'Facebook'],
  ['X', 'X'],
  ['YOUTUBE', 'YouTube'],
  ['TIKTOK', 'TikTok'],
] as const;
const inputClass = 'app-control mt-1';

export function AdminCardsPage() {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<UserCard | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const queryClient = useQueryClient();
  const cards = useQuery({
    queryKey: ['admin', 'cards', query, status, page],
    queryFn: () =>
      getAdminCards({
        query: query || undefined,
        status: status || undefined,
        page,
        pageSize: 25,
      }),
  });
  const statusChange = useMutation({
    mutationFn: ({
      cardId,
      action,
    }: {
      cardId: string;
      action: 'activate' | 'deactivate' | 'delete' | 'restore';
    }) => setAdminCardStatus(cardId, action),
    onSuccess: async (_result, variables) => {
      notify(
        variables.action === 'restore'
          ? 'Card restored as inactive'
          : `Card ${variables.action === 'delete' ? 'deleted' : `${variables.action}d`}`,
        'success',
      );
      await invalidateAdmin(queryClient);
    },
    onError: (error) => notify(errorMessage(error), 'error'),
  });

  function changeStatus(card: UserCard, action: 'activate' | 'deactivate' | 'delete' | 'restore') {
    const publicEffect: Record<typeof action, string> = {
      activate: 'The full card profile will become publicly visible.',
      deactivate: 'The public page will show only the card name and inactive status.',
      delete: 'The public profile and downloads will return not found. This is a soft delete.',
      restore: 'The card will be restored as inactive, showing only its name publicly.',
    };
    if (window.confirm(`${publicEffect[action]}\n\nContinue?`)) {
      statusChange.mutate({ cardId: card.id, action });
    }
  }

  return (
    <section className="space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-app-text">Cards</h1>
          <p className="mt-2 text-sm text-app-secondary">
            Search, edit, create, and manage card status.
          </p>
        </div>
        <button type="button" onClick={() => setCreateOpen(true)} className="app-button-primary">
          Add card
        </button>
      </header>
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="text-sm font-medium">
          Search owner email, card name, or slug
          <input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(1);
            }}
            className={inputClass}
            placeholder="Search cards"
          />
        </label>
        <label className="text-sm font-medium">
          Status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className={inputClass}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="DELETED">Deleted</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="LOST">Lost</option>
          </select>
        </label>
      </div>
      {cards.isLoading && <p className="text-sm text-slate-600">Loading cards…</p>}
      {cards.isError && (
        <ErrorState message="Could not load cards." onRetry={() => void cards.refetch()} />
      )}
      {cards.data && (
        <>
          {cards.data.items.length === 0 ? (
            <p className="app-card app-card-dashed p-8 text-center text-sm text-app-secondary">
              No matching cards.
            </p>
          ) : (
            <div className="grid gap-3">
              {cards.data.items.map((card) => (
                <article key={card.id} className="app-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold">{card.profile.fullName || 'Unnamed card'}</h2>
                        <StatusBadge status={card.status} />
                      </div>
                      <p className="mt-1 break-all text-sm text-slate-600">
                        {card.owner?.email ?? 'No owner email'}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        /{card.slug} · {formatPurpose(card.purpose)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {card.status !== 'DELETED' && (
                        <button
                          type="button"
                          onClick={() => setEditing(card)}
                          className="app-button-secondary"
                        >
                          Edit
                        </button>
                      )}
                      {card.status === 'ACTIVE' && (
                        <StatusButton
                          label="Deactivate"
                          onClick={() => changeStatus(card, 'deactivate')}
                        />
                      )}
                      {card.status === 'INACTIVE' && (
                        <StatusButton
                          label="Activate"
                          onClick={() => changeStatus(card, 'activate')}
                        />
                      )}
                      {card.status === 'DELETED' ? (
                        <StatusButton
                          label="Restore"
                          onClick={() => changeStatus(card, 'restore')}
                        />
                      ) : (
                        <StatusButton label="Delete" onClick={() => changeStatus(card, 'delete')} />
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-slate-600">
              {cards.data.total} cards · page {page}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage(page - 1)}
                className="app-button-secondary disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page * cards.data.pageSize >= cards.data.total}
                onClick={() => setPage(page + 1)}
                className="app-button-secondary disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}
      {createOpen && <CreateCardDialog onClose={() => setCreateOpen(false)} />}
      {editing && (
        <CardEditDialog
          key={editing.id}
          card={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await invalidateAdmin(queryClient);
          }}
        />
      )}
    </section>
  );
}

function CreateCardDialog({ onClose }: { onClose: () => void }) {
  const [ownerQuery, setOwnerQuery] = useState('');
  const [ownerEmail, setOwnerEmail] = useState('');
  const [purpose, setPurpose] = useState<CardPurpose>('PERSONAL');
  const [customPurpose, setCustomPurpose] = useState('');
  const [slug, setSlug] = useState('');
  const [error, setError] = useState('');
  const queryClient = useQueryClient();
  const matches = useQuery({
    queryKey: ['admin', 'user-search', ownerQuery],
    queryFn: () => getAdminUsers({ query: ownerQuery, page: 1, pageSize: 10 }),
    enabled: ownerQuery.trim().length >= 2,
  });
  const create = useMutation({
    mutationFn: createAdminCard,
    onSuccess: async () => {
      notify('Card created and activated', 'success');
      await invalidateAdmin(queryClient);
      onClose();
    },
    onError: (cause) => setError(errorMessage(cause)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    create.mutate({
      ownerEmail: ownerEmail || ownerQuery.trim(),
      purpose,
      ...(purpose === 'OTHER' ? { customPurpose } : {}),
      ...(slug.trim() ? { slug: slug.trim() } : {}),
    });
  }

  return (
    <Dialog title="Add card" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <label className="block text-sm font-medium">
          Find user by email
          <input
            type="email"
            required
            value={ownerEmail || ownerQuery}
            onChange={(event) => {
              setOwnerQuery(event.target.value);
              setOwnerEmail('');
            }}
            className={inputClass}
            placeholder="name@example.com"
          />
        </label>
        {ownerQuery.trim().length >= 2 && (
          <div className="max-h-40 overflow-auto rounded-lg border border-slate-200">
            {matches.isLoading && <p className="p-3 text-sm text-slate-500">Searching users…</p>}
            {matches.data?.items.length
              ? matches.data.items.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => {
                      setOwnerEmail(user.email);
                      setOwnerQuery(user.email);
                    }}
                    className="block min-h-11 w-full border-b border-app-border px-3 py-2 text-left text-sm hover:bg-app-light"
                  >
                    {user.email}
                    {user.name ? ` · ${user.name}` : ''}
                  </button>
                ))
              : matches.isSuccess && <p className="p-3 text-sm text-rose-700">User not found.</p>}
          </div>
        )}
        <label className="block text-sm font-medium">
          Purpose
          <select
            value={purpose}
            onChange={(event) => setPurpose(event.target.value as CardPurpose)}
            className={inputClass}
          >
            {CARD_PURPOSES.map((item) => (
              <option key={item} value={item}>
                {formatPurpose(item)}
              </option>
            ))}
          </select>
        </label>
        {purpose === 'OTHER' && (
          <label className="block text-sm font-medium">
            Custom purpose
            <input
              required
              value={customPurpose}
              onChange={(event) => setCustomPurpose(event.target.value)}
              maxLength={80}
              className={inputClass}
            />
          </label>
        )}
        <label className="block text-sm font-medium">
          Custom slug (optional)
          <input
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
            maxLength={48}
            className={inputClass}
            placeholder="Generated if empty"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-rose-700">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="app-button-secondary">
            Cancel
          </button>
          <button disabled={create.isPending} className="app-button-primary">
            {create.isPending ? 'Creating…' : 'Create active card'}
          </button>
        </div>
      </form>
    </Dialog>
  );
}

function CardEditDialog({
  card,
  onClose,
  onSaved,
}: {
  card: UserCard;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const [details, setDetails] = useState<CardData>({
    slug: card.slug,
    purpose: card.purpose,
    ...(card.customPurpose ? { customPurpose: card.customPurpose } : {}),
  });
  const [profile, setProfile] = useState<CardProfileData>(card.profile);
  const [office, setOffice] = useState<CardOffice>(
    CardOfficeSchema.parse(card.office ?? { hasOffice: false }),
  );
  const [products, setProducts] = useState<ProductDraft[]>(
    card.products.map((item) => ({
      image: item.image,
      name: item.name,
      price: item.price == null ? '' : String(item.price),
      currency: item.currency,
      detail: item.detail,
    })),
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();

  function updateProfile<K extends keyof CardProfileData>(key: K, value: CardProfileData[K]) {
    setProfile((current) => ({ ...current, [key]: value }));
  }
  function updateContact<K extends keyof CardProfileData['contact']>(key: K, value: string) {
    setProfile((current) => ({
      ...current,
      contact: { ...current.contact, [key]: value || null },
    }));
  }
  function updateOffice<K extends keyof CardOffice>(key: K, value: CardOffice[K]) {
    setOffice((current) => ({ ...current, [key]: value }));
  }
  function updateSocial(
    platform: CardProfileData['socialLinks'][number]['platform'],
    value: string,
  ) {
    const rest = profile.socialLinks.filter((entry) => entry.platform !== platform);
    if (value.trim()) rest.push({ platform, url: value.trim() });
    updateProfile('socialLinks', rest);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const parsedCard = CardDataSchema.safeParse(details);
    const parsedProfile = CardProfileDataSchema.safeParse(profile);
    const parsedOffice = CardOfficeSchema.safeParse(office);
    const parsedProducts = CardProductsSchema.safeParse(
      products.map((product, sortOrder) => ({
        image: product.image,
        name: product.name,
        ...(product.price.trim() ? { price: Number(product.price) } : {}),
        currency: product.currency.toUpperCase(),
        detail: product.detail,
        sortOrder,
      })),
    );
    if (
      !parsedCard.success ||
      !parsedProfile.success ||
      !parsedOffice.success ||
      !parsedProducts.success
    ) {
      const issue = [
        ...(!parsedCard.success ? parsedCard.error.issues : []),
        ...(!parsedProfile.success ? parsedProfile.error.issues : []),
        ...(!parsedOffice.success ? parsedOffice.error.issues : []),
        ...(!parsedProducts.success ? parsedProducts.error.issues : []),
      ][0];
      setError(
        issue
          ? `${issue.path.join('.')}: ${issue.message}`
          : 'Please review the highlighted values.',
      );
      return;
    }
    setSaving(true);
    try {
      await updateAdminCard(card.id, {
        card: parsedCard.data,
        profile: parsedProfile.data,
        office: parsedOffice.data,
        products: parsedProducts.data,
      });
      notify('Card updated', 'success');
      await onSaved();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const currentClass = 'app-control mt-1';
  return (
    <Dialog title={`Edit ${card.profile.fullName || card.slug}`} onClose={onClose} wide>
      <form onSubmit={(event) => void submit(event)} className="space-y-5">
        <fieldset className="grid gap-3 rounded-xl border border-app-border p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Card</legend>
          <Field label="Slug">
            <input
              value={details.slug}
              onChange={(event) => setDetails({ ...details, slug: event.target.value })}
              maxLength={48}
              className={currentClass}
            />
          </Field>
          <Field label="Purpose">
            <select
              value={details.purpose}
              onChange={(event) =>
                setDetails({
                  ...details,
                  purpose: event.target.value as CardPurpose,
                  ...(event.target.value === 'OTHER' ? {} : { customPurpose: undefined }),
                })
              }
              className={currentClass}
            >
              {CARD_PURPOSES.map((purpose) => (
                <option key={purpose} value={purpose}>
                  {formatPurpose(purpose)}
                </option>
              ))}
            </select>
          </Field>
          {details.purpose === 'OTHER' && (
            <Field label="Custom purpose">
              <input
                value={details.customPurpose ?? ''}
                onChange={(event) => setDetails({ ...details, customPurpose: event.target.value })}
                maxLength={80}
                className={currentClass}
              />
            </Field>
          )}
        </fieldset>

        <fieldset className="grid gap-3 rounded-xl border border-app-border p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Profile</legend>
          <Field label="Full name">
            <input
              value={profile.fullName}
              onChange={(event) => updateProfile('fullName', event.target.value)}
              maxLength={100}
              className={currentClass}
            />
          </Field>
          <Field label="Job title">
            <input
              value={profile.jobTitle ?? ''}
              onChange={(event) => updateProfile('jobTitle', event.target.value || null)}
              maxLength={100}
              className={currentClass}
            />
          </Field>
          <Field label="Skills line">
            <input
              value={profile.skillsLine ?? ''}
              onChange={(event) => updateProfile('skillsLine', event.target.value || null)}
              maxLength={120}
              className={currentClass}
            />
          </Field>
          <Field label="Tagline">
            <input
              value={profile.tagline ?? ''}
              onChange={(event) => updateProfile('tagline', event.target.value || null)}
              maxLength={120}
              className={currentClass}
            />
          </Field>
          <Field label="Avatar HTTPS URL">
            <input
              value={profile.avatar ?? ''}
              onChange={(event) => updateProfile('avatar', event.target.value || null)}
              className={currentClass}
            />
          </Field>
          <Field label="Cover HTTPS URL">
            <input
              value={profile.cover ?? ''}
              onChange={(event) => updateProfile('cover', event.target.value || null)}
              className={currentClass}
            />
          </Field>
          <Field label="Theme color">
            <input
              type="color"
              value={profile.themeColor}
              onChange={(event) => updateProfile('themeColor', event.target.value)}
              className={`${currentClass} p-1`}
            />
          </Field>
          <div className="sm:col-span-2">
            <ProfileTemplatePicker
              value={profile.templateId}
              savedValue={card.profile.templateId}
              onChange={(templateId) => updateProfile('templateId', templateId)}
            />
          </div>
          <Field label="Gallery image URLs (one HTTPS URL per line)">
            <textarea
              value={profile.gallery.join('\n')}
              onChange={(event) =>
                updateProfile('gallery', event.target.value.split('\n').filter(Boolean))
              }
              rows={3}
              className={currentClass}
            />
          </Field>
        </fieldset>

        <fieldset className="grid gap-3 rounded-xl border border-app-border p-4 sm:grid-cols-2">
          <legend className="px-1 text-sm font-semibold">Contact and social</legend>
          <Field label="Phone (E.164)">
            <input
              value={profile.contact.phone ?? ''}
              onChange={(event) => updateContact('phone', event.target.value)}
              className={currentClass}
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              value={profile.contact.email ?? ''}
              onChange={(event) => updateContact('email', event.target.value)}
              className={currentClass}
            />
          </Field>
          <Field label="Location">
            <input
              value={profile.contact.location ?? ''}
              onChange={(event) => updateContact('location', event.target.value)}
              maxLength={100}
              className={currentClass}
            />
          </Field>
          <Field label="Website (HTTPS)">
            <input
              value={profile.contact.website ?? ''}
              onChange={(event) => updateContact('website', event.target.value)}
              className={currentClass}
            />
          </Field>
          {SOCIALS.map(([platform, label]) => (
            <Field key={platform} label={`${label} URL`}>
              <input
                value={profile.socialLinks.find((item) => item.platform === platform)?.url ?? ''}
                onChange={(event) => updateSocial(platform, event.target.value)}
                className={currentClass}
              />
            </Field>
          ))}
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-app-border p-4">
          <legend className="px-1 text-sm font-semibold">Office details</legend>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={office.hasOffice}
              onChange={(event) => updateOffice('hasOffice', event.target.checked)}
            />
            Show office details on the profile
          </label>
          {office.hasOffice && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Company name">
                <input
                  value={office.companyName ?? ''}
                  onChange={(event) => updateOffice('companyName', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Designation">
                <input
                  value={office.designation ?? ''}
                  onChange={(event) => updateOffice('designation', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Department">
                <input
                  value={office.department ?? ''}
                  onChange={(event) => updateOffice('department', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Office address">
                <input
                  value={office.officeAddress ?? ''}
                  onChange={(event) => updateOffice('officeAddress', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Office phone (E.164)">
                <input
                  value={office.officePhone ?? ''}
                  onChange={(event) => updateOffice('officePhone', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Office email">
                <input
                  value={office.officeEmail ?? ''}
                  onChange={(event) => updateOffice('officeEmail', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Company website (HTTPS)">
                <input
                  value={office.companyWebsite ?? ''}
                  onChange={(event) => updateOffice('companyWebsite', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
              <Field label="Working hours">
                <input
                  value={office.workingHours ?? ''}
                  onChange={(event) => updateOffice('workingHours', event.target.value || null)}
                  className={currentClass}
                />
              </Field>
            </div>
          )}
        </fieldset>

        <fieldset className="space-y-3 rounded-xl border border-app-border p-4">
          <legend className="px-1 text-sm font-semibold">Products or services</legend>
          <p className="rounded-xl bg-app-light p-3 text-xs leading-5 text-app-hover">
            Product or service photos must be served from the card image storage. If uploads are
            unavailable, check the API R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
            R2_BUCKET_NAME, and R2_PUBLIC_BASE_URL settings, plus NEXT_PUBLIC_R2_PUBLIC_BASE_URL for
            the web app.
          </p>
          <label className="flex min-h-11 items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={profile.showProducts}
              onChange={(event) => updateProfile('showProducts', event.target.checked)}
            />
            Do you offer products or services?
          </label>
          {products.length === 0 && (
            <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
              No products or services have been added to this card.
            </p>
          )}
          {products.map((product, index) => (
            <div key={index} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
              <Field label="Photo" hint="Enter an HTTPS image URL.">
                <input
                  value={product.image}
                  onChange={(event) => updateProduct(index, 'image', event.target.value)}
                  placeholder="https://"
                  className={currentClass}
                />
              </Field>
              <Field label="Name">
                <input
                  value={product.name}
                  onChange={(event) => updateProduct(index, 'name', event.target.value)}
                  maxLength={100}
                  placeholder="e.g. Logo design or Leather wallet"
                  className={currentClass}
                />
              </Field>
              <Field label="Price (optional)">
                <input
                  inputMode="decimal"
                  value={product.price}
                  onChange={(event) => updateProduct(index, 'price', event.target.value)}
                  placeholder="Leave blank to hide price"
                  className={currentClass}
                />
              </Field>
              <Field label="Currency">
                <input
                  value={product.currency}
                  onChange={(event) => updateProduct(index, 'currency', event.target.value)}
                  maxLength={3}
                  className={currentClass}
                />
              </Field>
              <Field label="Short description">
                <input
                  value={product.detail}
                  onChange={(event) => updateProduct(index, 'detail', event.target.value)}
                  maxLength={120}
                  placeholder="One short line about what you offer"
                  className={currentClass}
                />
              </Field>
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => moveProduct(index, -1)}
                  className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40"
                >
                  Up
                </button>
                <button
                  type="button"
                  disabled={index === products.length - 1}
                  onClick={() => moveProduct(index, 1)}
                  className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40"
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setProducts((current) =>
                      current.filter((_item, itemIndex) => itemIndex !== index),
                    )
                  }
                  className="min-h-10 rounded-lg border border-rose-200 px-3 text-sm text-rose-700"
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
          <button
            type="button"
            disabled={products.length >= 5}
            onClick={() =>
              setProducts((current) => [
                ...current,
                { image: '', name: '', price: '', currency: 'USD', detail: '' },
              ])
            }
            className="min-h-10 rounded-lg border px-3 text-sm disabled:opacity-40"
          >
            Add product or service
          </button>
        </fieldset>
        {error && (
          <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="app-button-secondary">
            Cancel
          </button>
          <button disabled={saving} className="app-button-primary">
            {saving ? 'Saving…' : 'Save card'}
          </button>
        </div>
      </form>
    </Dialog>
  );

  function updateProduct(index: number, key: keyof ProductDraft, value: string) {
    setProducts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, [key]: value } : item)),
    );
  }
  function moveProduct(index: number, direction: -1 | 1) {
    setProducts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });
  }
}

function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  return (
    <div
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 sm:p-6"
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`app-card max-h-[95vh] w-full overflow-y-auto p-5 sm:p-7 ${wide ? 'max-w-4xl' : 'max-w-lg'}`}
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="app-button-secondary min-h-10 min-w-10 p-0 text-lg"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {children}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const style =
    status === 'ACTIVE'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'DELETED'
        ? 'bg-rose-100 text-rose-800'
        : 'bg-slate-100 text-slate-700';
  return (
    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${style}`}>
      {status}
    </span>
  );
}

function StatusButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="app-button-secondary">
      {label}
    </button>
  );
}

function formatPurpose(value: string) {
  return value
    .toLowerCase()
    .split('_')
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1)}`)
    .join(' ');
}

function notify(message: string, tone: 'success' | 'error') {
  window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, tone } }));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed.';
}

async function invalidateAdmin(queryClient: ReturnType<typeof useQueryClient>) {
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: ['admin'] }),
    queryClient.invalidateQueries({ queryKey: ['cards', 'me'] }),
  ]);
}
