'use client';

import Image from 'next/image';
import {
  CARD_PURPOSES,
  CardDataSchema,
  CardOfficeSchema,
  CardProductResponseSchema,
  CardSlugSchema,
  CardSocialLinkSchema,
  CardProfileDataSchema,
  CardProductsSchema,
  DEFAULT_PROFILE_THEME_COLOR,
  PROFILE_TEMPLATE_OPTIONS,
  PROFILE_THEME_PRESETS,
  ProfilePreviewDataSchema,
  PublicProfileApiSchema,
  type CardData,
  type CardOffice,
  type CardProfileData,
  type ProfilePreviewData,
  type PublicProfileApi,
} from '@nfc/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { z } from 'zod';
import { ProfilePreviewFrame } from './ProfilePreviewFrame';
import { ProfileTemplatePicker } from './ProfileTemplatePicker';
import { ApiError } from '@/lib/api/client';
import {
  addCardProduct,
  getMyCard,
  getMyCards,
  removeCardProduct,
  reorderCardProducts,
  updateCardDetails,
  updateCardOffice,
  updateCardProduct,
  updateCardProfile,
  uploadCardImage,
  type CardUploadKind,
  type UserCard,
} from '@/lib/api/cards';
import { CARDS_QUERY_KEY } from '@/features/dashboard/components/CardNavigation';
import { getImageUploadErrorMessage, validateImageFile } from '../image-upload-errors';

type SocialPlatform = CardProfileData['socialLinks'][number]['platform'];
type ProductDraft = {
  id: string | null;
  image: string;
  name: string;
  price: string;
  currency: string;
  detail: string;
};
type StepId = 'basic' | 'contact' | 'images' | 'office' | 'products' | 'theme' | 'preview';
type ErrorMap = Record<string, string>;

const STEPS: Array<{ id: StepId; label: string }> = [
  { id: 'basic', label: 'Basic info' },
  { id: 'contact', label: 'Contact & social' },
  { id: 'images', label: 'Images & gallery' },
  { id: 'office', label: 'Office' },
  { id: 'products', label: 'Products or services' },
  { id: 'theme', label: 'Theme' },
  { id: 'preview', label: 'Preview' },
];
const socialPlatforms: Array<{ value: SocialPlatform; label: string }> = [
  { value: 'WEBSITE', label: 'Other website' },
  { value: 'LINKEDIN', label: 'LinkedIn' },
  { value: 'GITHUB', label: 'GitHub' },
  { value: 'INSTAGRAM', label: 'Instagram' },
  { value: 'FACEBOOK', label: 'Facebook' },
  { value: 'X', label: 'X' },
  { value: 'YOUTUBE', label: 'YouTube' },
  { value: 'TIKTOK', label: 'TikTok' },
];
const MAX_FILE_BYTES: Record<CardUploadKind, number> = {
  AVATAR: 2 * 1024 * 1024,
  COVER: 5 * 1024 * 1024,
  GALLERY: 5 * 1024 * 1024,
  PRODUCT: 3 * 1024 * 1024,
};
const draftSchema = z.object({
  details: CardDataSchema,
  profile: CardProfileDataSchema,
  office: CardOfficeSchema,
  products: z.array(
    z.object({
      id: z.string().nullable(),
      image: z.string(),
      name: z.string(),
      price: z.string(),
      currency: z.string(),
      detail: z.string(),
    }),
  ),
});
const inputClass = 'app-control mt-1';

export function CardProfileEditor({ initialCardId }: { initialCardId?: string }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const cardId = initialCardId ?? '';
  const cards = useQuery({ queryKey: CARDS_QUERY_KEY, queryFn: getMyCards });
  const cardQuery = useQuery({
    queryKey: ['cards', 'me', cardId],
    queryFn: () => getMyCard(cardId),
    enabled: Boolean(cardId),
  });
  const [card, setCard] = useState<UserCard | null>(null);
  const [loadedId, setLoadedId] = useState('');
  const [step, setStep] = useState<StepId>('basic');
  const [details, setDetails] = useState<CardData | null>(null);
  const [profile, setProfile] = useState<CardProfileData | null>(null);
  const [office, setOffice] = useState<CardOffice | null>(null);
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [fieldErrors, setFieldErrors] = useState<ErrorMap>({});
  const [serverError, setServerError] = useState('');
  const [success, setSuccess] = useState('');
  const [dirty, setDirty] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadsInProgress, setUploadsInProgress] = useState(0);
  const [showProducts, setShowProducts] = useState(false);
  const [widePreview, setWidePreview] = useState(false);
  const draftKey = `card-profile-draft:${cardId}`;

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1280px)');
    const updatePreviewLayout = () => setWidePreview(mediaQuery.matches);
    updatePreviewLayout();
    mediaQuery.addEventListener('change', updatePreviewLayout);
    return () => mediaQuery.removeEventListener('change', updatePreviewLayout);
  }, []);

  useEffect(() => {
    const urlCardId = new URLSearchParams(window.location.search).get('card');
    if (!urlCardId) {
      const dirtyCardId = window.sessionStorage.getItem('card-profile-dirty-card');
      if (dirtyCardId) {
        window.history.replaceState(
          window.history.state,
          '',
          `/dashboard/profile?card=${encodeURIComponent(dirtyCardId)}`,
        );
        router.refresh();
      }
    }
  }, [router]);

  useEffect(() => {
    if (!cardId && cards.data?.length) {
      router.replace(`/dashboard/profile?card=${encodeURIComponent(cards.data[0].id)}`);
    }
  }, [cardId, cards.data, router]);

  useEffect(() => {
    if (!cardQuery.data || loadedId === cardId) return;
    const loaded = cardQuery.data;
    setCard(loaded);
    setDetails({
      slug: loaded.slug,
      purpose: loaded.purpose,
      ...(loaded.customPurpose ? { customPurpose: loaded.customPurpose } : {}),
    });
    setProfile(loaded.profile);
    setOffice(CardOfficeSchema.parse(loaded.office ?? { hasOffice: false }));
    setProducts(
      loaded.products.map((item) => ({
        id: item.id,
        image: item.image,
        name: item.name,
        price: item.price === null || item.price === undefined ? '' : String(item.price),
        currency: item.currency,
        detail: item.detail,
      })),
    );
    setShowProducts(loaded.profile.showProducts);
    setDirty(false);
    setLoadedId(cardId);
    setServerError('');

    const savedDraft = window.sessionStorage.getItem(`card-profile-draft:${cardId}`);
    if (savedDraft) {
      try {
        const restored = draftSchema.safeParse(JSON.parse(savedDraft) as unknown);
        if (restored.success) {
          setDetails(restored.data.details);
          setProfile(restored.data.profile);
          setOffice(restored.data.office);
          setProducts(restored.data.products);
          setShowProducts(restored.data.profile.showProducts);
          setDirty(true);
        } else {
          setServerError(
            'A saved draft could not be restored. Your current card data is still available.',
          );
        }
      } catch {
        setServerError(
          'A saved draft could not be restored. Your current card data is still available.',
        );
      }
    }
  }, [cardId, cardQuery.data, loadedId]);

  useEffect(() => {
    if (!dirty || !details || !profile || !office || !cardId) return;
    window.sessionStorage.setItem(
      `card-profile-draft:${cardId}`,
      JSON.stringify({ details, profile, office, products }),
    );
    window.sessionStorage.setItem('card-profile-dirty-card', cardId);
  }, [cardId, details, dirty, office, products, profile]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    const confirmNavigation = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement) || anchor.target === '_blank') return;
      if (anchor.origin !== window.location.origin || anchor.href === window.location.href) return;
      if (!window.confirm('You have unsaved changes. Leave this page?')) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', warn);
    document.addEventListener('click', confirmNavigation, true);
    return () => {
      window.removeEventListener('beforeunload', warn);
      document.removeEventListener('click', confirmNavigation, true);
    };
  }, [dirty]);

  if (!cardId) {
    if (cards.isLoading) return <p className="text-sm text-slate-600">Loading cards…</p>;
    if (cards.data?.length) return <p className="text-sm text-slate-600">Opening your card…</p>;
    return <EmptyCardState />;
  }
  if (cardQuery.isLoading || !card || !details || !profile || !office) {
    if (cardQuery.isError) {
      return (
        <ErrorMessage
          message="Could not load this card."
          onRetry={() => void cardQuery.refetch()}
        />
      );
    }
    return <p className="text-sm text-slate-600">Loading card profile…</p>;
  }

  const currentStepIndex = STEPS.findIndex((item) => item.id === step);
  const previewData = buildProfilePreviewData(
    details.slug,
    profile,
    office,
    products,
    showProducts,
  );
  const publicHref = `/u/${encodeURIComponent(details.slug)}`;
  const savedTemplateId = card.profile.templateId;

  function restoreSavedTemplate() {
    if (!card || !details || !profile || !office) return;
    const restoredProfile = { ...profile, templateId: savedTemplateId };
    setProfile(restoredProfile);
    setDirty(!isDraftEqualToCard(card, details, restoredProfile, office, products));
    setSuccess('');
  }

  function updateProfile<K extends keyof CardProfileData>(key: K, value: CardProfileData[K]) {
    setDirty(true);
    setSuccess('');
    setProfile((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateContact(key: keyof CardProfileData['contact'], value: string) {
    if (!profile) return;
    updateProfile('contact', { ...profile.contact, [key]: value || null });
  }

  function updateOfficeValue<K extends keyof CardOffice>(key: K, value: CardOffice[K]) {
    setDirty(true);
    setOffice((current) => (current ? { ...current, [key]: value } : current));
  }

  function updateDetail<K extends keyof CardData>(key: K, value: CardData[K]) {
    setDirty(true);
    setSuccess('');
    setDetails((current) => (current ? { ...current, [key]: value } : current));
  }

  function socialUrl(platform: SocialPlatform): string {
    return profile?.socialLinks.find((link) => link.platform === platform)?.url ?? '';
  }

  function changeSocial(platform: SocialPlatform, url: string) {
    if (!profile) return;
    const socialLinks = profile.socialLinks.filter((link) => link.platform !== platform);
    if (url.trim()) socialLinks.push({ platform, url: url.trim() });
    updateProfile('socialLinks', socialLinks);
  }

  function changeProduct(index: number, patch: Partial<ProductDraft>) {
    setDirty(true);
    setSuccess('');
    setFieldErrors((current) => {
      const next = { ...current };
      for (const key of Object.keys(patch)) delete next[`products.${index}.${key}`];
      return next;
    });
    setProducts((current) =>
      current.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    );
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details || !profile || !office || !card || saving || uploadsInProgress > 0) return;
    setFieldErrors({});
    setSuccess('');
    setServerError('');

    const parsedDetails = CardDataSchema.safeParse(details);
    const parsedProfile = CardProfileDataSchema.safeParse({
      ...profile,
      showProducts,
    });
    const parsedOffice = CardOfficeSchema.safeParse(office);
    const parsedProducts = CardProductsSchema.safeParse(
      products.map((item, sortOrder) => ({
        image: item.image,
        name: item.name,
        ...(item.price.trim() ? { price: Number(item.price) } : {}),
        currency: item.currency.toUpperCase(),
        detail: item.detail,
        sortOrder,
      })),
    );
    if (
      !parsedDetails.success ||
      !parsedProfile.success ||
      !parsedOffice.success ||
      (showProducts && !parsedProducts.success)
    ) {
      const issues = [
        ...(parsedDetails.success ? [] : parsedDetails.error.issues),
        ...(parsedProfile.success ? [] : parsedProfile.error.issues),
        ...(parsedOffice.success ? [] : parsedOffice.error.issues),
        ...(showProducts && !parsedProducts.success ? parsedProducts.error.issues : []),
      ];
      const fieldKeyForIssue = (issue: z.ZodIssue) => {
        const [first, second] = issue.path;
        if (typeof first === 'number') return `products.${issue.path.join('.')}`;
        if (first === 'socialLinks' && typeof second === 'number') {
          const platform = profile.socialLinks[second]?.platform;
          return platform ? `socialLinks.${platform}` : issue.path.join('.');
        }
        return issue.path.join('.');
      };
      const errors = Object.fromEntries(
        issues.map((issue) => [fieldKeyForIssue(issue), issue.message]),
      );
      setFieldErrors(errors);
      const firstPath = issues[0] ? fieldKeyForIssue(issues[0]) : '';
      setStep(stepForField(firstPath));
      window.setTimeout(() => {
        const field = document.querySelector<HTMLElement>(
          `[name="${CSS.escape(firstPath)}"], [data-field="${CSS.escape(firstPath)}"]`,
        );
        field?.focus();
      }, 0);
      showValidationError('Please fix the highlighted fields');
      return;
    }

    setSaving(true);
    try {
      let updated = await updateCardDetails(card.id, parsedDetails.data);
      setCard(updated);
      await updateCardProfile(card.id, parsedProfile.data);
      updated = await updateCardOffice(card.id, parsedOffice.data);
      setCard(updated);

      if (showProducts && parsedProducts.success) {
        const currentIds = new Set(products.flatMap((item) => (item.id ? [item.id] : [])));
        for (const oldProduct of updated.products) {
          if (!currentIds.has(oldProduct.id)) {
            updated = await removeCardProduct(card.id, oldProduct.id);
            setCard(updated);
          }
        }

        let workingProducts = [...products];
        for (let index = 0; index < workingProducts.length; index += 1) {
          const item = workingProducts[index];
          if (!item) continue;
          const product = parsedProducts.data[index];
          if (!product) continue;
          const payload = {
            image: product.image,
            name: product.name,
            ...(product.price === undefined ? {} : { price: product.price }),
            currency: product.currency,
            detail: product.detail,
          };
          if (item.id) {
            updated = await updateCardProduct(card.id, item.id, payload);
            setCard(updated);
          } else {
            const priorIds = new Set(updated.products.map((saved) => saved.id));
            updated = await addCardProduct(card.id, payload);
            const added = updated.products.find((saved) => !priorIds.has(saved.id));
            if (added) {
              workingProducts[index] = { ...item, id: added.id };
              setProducts(workingProducts);
            }
            setCard(updated);
          }
        }
        const orderedIds = workingProducts.flatMap((item) => (item.id ? [item.id] : []));
        if (
          updated.products.length !== orderedIds.length ||
          updated.products.some((item, index) => item.id !== orderedIds[index])
        ) {
          updated = await reorderCardProducts(card.id, orderedIds);
          setCard(updated);
        }
      }

      queryClient.setQueryData(['cards', 'me', card.id], updated);
      await queryClient.invalidateQueries({ queryKey: CARDS_QUERY_KEY });
      setProfile(parsedProfile.data);
      setCard({ ...updated, profile: parsedProfile.data });
      setOffice(parsedOffice.data);
      setDetails(parsedDetails.data);
      setProducts(
        updated.products.map((item) => ({
          id: item.id,
          image: item.image,
          name: item.name,
          price: item.price == null ? '' : String(item.price),
          currency: item.currency,
          detail: item.detail,
        })),
      );
      setDirty(false);
      setSuccess('Card profile saved');
      setServerError('');
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: { message: 'Card profile saved', tone: 'success' },
        }),
      );
      window.sessionStorage.removeItem(draftKey);
      window.sessionStorage.removeItem('card-profile-dirty-card');
    } catch (cause) {
      if (cause instanceof ApiError && cause.statusCode === 401) {
        router.replace(`/login?next=${encodeURIComponent(`/dashboard/profile?card=${card.id}`)}`);
        return;
      }
      if (cause instanceof ApiError && [403, 404].includes(cause.statusCode)) {
        router.replace('/dashboard?notice=card-unavailable');
        return;
      }
      const message = cause instanceof Error ? cause.message : 'Could not save your card profile.';
      setServerError(message);
      window.dispatchEvent(
        new CustomEvent('app-toast', {
          detail: {
            message,
            tone: 'error',
            retry: () =>
              document.querySelector<HTMLFormElement>('#card-profile-form')?.requestSubmit(),
          },
        }),
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadFile(
    kind: CardUploadKind,
    file: File,
    onProgress: (progress: number) => void = () => undefined,
  ): Promise<string> {
    if (!card) throw new Error('This card is unavailable.');
    validateImageFile(file, MAX_FILE_BYTES[kind]);
    setDirty(true);
    setUploadsInProgress((count) => count + 1);
    try {
      return await uploadCardImage(card.id, kind, file, onProgress);
    } finally {
      setUploadsInProgress((count) => Math.max(0, count - 1));
    }
  }

  async function upload(
    kind: CardUploadKind,
    file: File,
    complete: (url: string) => void,
    onProgress: (progress: number) => void = () => undefined,
  ): Promise<boolean> {
    setUploadError('');
    try {
      const url = await uploadFile(kind, file, onProgress);
      complete(url);
      setDirty(true);
      return true;
    } catch (cause) {
      const message = getImageUploadErrorMessage(cause);
      setUploadError(message);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, tone: 'error' } }));
      return false;
    }
  }

  function handleImageChange(kind: CardUploadKind, complete: (url: string) => void) {
    return (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (file) void upload(kind, file, complete);
    };
  }

  function addProduct() {
    if (products.length >= 5) return;
    setDirty(true);
    setProducts((current) => [
      ...current,
      { id: null, image: '', name: '', price: '', currency: 'USD', detail: '' },
    ]);
  }

  function removeProduct(index: number) {
    if (!window.confirm('Remove this product or service from the card profile?')) return;
    setDirty(true);
    setProducts((current) => current.filter((_item, itemIndex) => itemIndex !== index));
  }

  function reorderProduct(index: number, direction: -1 | 1) {
    setDirty(true);
    setProducts((current) => {
      const target = index + direction;
      if (target < 0 || target >= current.length) return current;
      const next = [...current];
      const currentItem = next[index];
      const targetItem = next[target];
      if (!currentItem || !targetItem) return current;
      next[index] = targetItem;
      next[target] = currentItem;
      return next;
    });
  }

  function profileFieldError(name: string) {
    return fieldErrors[name] ?? fieldErrors[`profile.${name}`];
  }

  function showValidationError(message: string) {
    setServerError(message);
    if (message === 'Please fix the highlighted fields') {
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, tone: 'error' } }));
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight text-app-text">
          Customize {profile.fullName || 'card'}
        </h1>
        <p className="mt-2 text-sm text-app-secondary">
          This profile belongs to this card and will not change when you update your account.
        </p>
      </header>

      <div className="mb-6">
        <div className="mb-3 flex items-center gap-3 rounded-xl border border-app-primary-border bg-app-light p-3 md:hidden">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-primary text-sm font-bold text-white">
            {currentStepIndex + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-xs font-medium text-app-secondary">
              Step {currentStepIndex + 1} of {STEPS.length}
            </span>
            <span className="block truncate text-sm font-semibold text-app-text">
              {STEPS[currentStepIndex]?.label}
            </span>
          </span>
          <button
            type="button"
            onClick={() => setStep(step === 'preview' ? 'basic' : 'preview')}
            className="app-button-secondary min-h-9 px-3 text-xs md:hidden"
          >
            {step === 'preview' ? 'Edit' : 'Preview'}
          </button>
        </div>
        <nav
          aria-label="Profile customization steps"
          className="hidden gap-2 md:grid md:grid-cols-7"
        >
          {STEPS.map((item, index) => {
            const isInvalid = Object.keys(fieldErrors).some(
              (field) => stepForField(field) === item.id,
            );
            const isComplete = index < currentStepIndex;
            return (
              <button
                key={item.id}
                type="button"
                aria-current={step === item.id ? 'step' : undefined}
                onClick={() => setStep(item.id)}
                className={`flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-center text-[11px] font-medium leading-tight transition ${
                  step === item.id
                    ? 'border-app-primary bg-app-light text-app-hover'
                    : isComplete
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-app-border bg-white text-app-secondary hover:bg-slate-50'
                } ${isInvalid ? 'border-rose-400 text-rose-700' : ''}`}
              >
                <span
                  aria-hidden="true"
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    isComplete
                      ? 'bg-emerald-600 text-white'
                      : step === item.id
                        ? 'bg-app-primary text-white'
                        : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {isComplete ? '✓' : index + 1}
                </span>
                <span>{item.label}</span>
                {isInvalid && <span className="sr-only">, contains errors</span>}
              </button>
            );
          })}
        </nav>
        <div
          className="mt-3 h-1.5 rounded-full bg-slate-200"
          role="progressbar"
          aria-label="Profile setup progress"
          aria-valuemin={0}
          aria-valuemax={STEPS.length}
          aria-valuenow={currentStepIndex + 1}
        >
          <div
            className="h-full rounded-full bg-app-primary transition-all"
            style={{ width: `${((currentStepIndex + 1) / STEPS.length) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)]">
        <form
          id="card-profile-form"
          onSubmit={(event) => void save(event)}
          noValidate
          className="min-w-0"
        >
          <section className={step === 'basic' ? 'app-card space-y-5 p-5 sm:p-7' : 'hidden'}>
            <SectionHeading
              title="Basic info"
              detail="Choose what this card represents and how people find it."
            />
            <Field label="What is this card for?" error={fieldErrors.purpose}>
              <select
                name="purpose"
                value={details.purpose}
                onChange={(event) =>
                  updateDetail('purpose', event.target.value as CardData['purpose'])
                }
                className={inputClass}
              >
                {CARD_PURPOSES.map((purpose) => (
                  <option key={purpose} value={purpose}>
                    {purpose === 'OTHER'
                      ? 'Other'
                      : purpose
                          .replaceAll('_', ' ')
                          .toLowerCase()
                          .replace(/\b\w/g, (letter) => letter.toUpperCase())}
                  </option>
                ))}
              </select>
            </Field>
            {details.purpose === 'OTHER' && (
              <Field label="Custom purpose" error={fieldErrors.customPurpose}>
                <input
                  name="customPurpose"
                  value={details.customPurpose ?? ''}
                  onChange={(event) => updateDetail('customPurpose', event.target.value)}
                  maxLength={80}
                  className={inputClass}
                />
              </Field>
            )}
            <Field
              label="Card public URL"
              hint="Use lowercase letters, numbers, and single hyphens."
              error={fieldErrors.slug}
            >
              <div className="flex items-center gap-2">
                <span className="rounded-lg bg-slate-100 px-3 py-3 text-sm text-slate-600">
                  /u/
                </span>
                <input
                  name="slug"
                  value={details.slug}
                  onChange={(event) => updateDetail('slug', event.target.value)}
                  maxLength={48}
                  autoComplete="off"
                  className={inputClass}
                />
              </div>
            </Field>
            <Field label="Full name" error={profileFieldError('fullName')}>
              <input
                name="fullName"
                value={profile.fullName}
                onChange={(event) => updateProfile('fullName', event.target.value)}
                maxLength={100}
                autoComplete="name"
                className={inputClass}
              />
            </Field>
            <Field label="Job title" error={profileFieldError('jobTitle')}>
              <input
                name="jobTitle"
                value={profile.jobTitle ?? ''}
                onChange={(event) => updateProfile('jobTitle', event.target.value || null)}
                maxLength={100}
                className={inputClass}
              />
            </Field>
            <Field label="Skills" error={profileFieldError('skillsLine')}>
              <input
                name="skillsLine"
                value={profile.skillsLine ?? ''}
                onChange={(event) => updateProfile('skillsLine', event.target.value || null)}
                maxLength={120}
                className={inputClass}
              />
            </Field>
            <Field label="Tagline" error={profileFieldError('tagline')}>
              <textarea
                name="tagline"
                value={profile.tagline ?? ''}
                onChange={(event) => updateProfile('tagline', event.target.value || null)}
                maxLength={120}
                rows={3}
                className={inputClass}
              />
            </Field>
          </section>

          <section className={step === 'contact' ? 'app-card space-y-5 p-5 sm:p-7' : 'hidden'}>
            <SectionHeading title="Contact and social" detail="These values are card-specific." />
            <Field
              label="Phone"
              hint="International E.164 format, e.g. +94771234567."
              error={profileFieldError('contact.phone')}
            >
              <input
                name="contact.phone"
                type="tel"
                inputMode="tel"
                value={profile.contact.phone ?? ''}
                onChange={(event) => updateContact('phone', event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Public email" error={profileFieldError('contact.email')}>
              <input
                name="contact.email"
                type="email"
                value={profile.contact.email ?? ''}
                onChange={(event) => updateContact('email', event.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Location" error={profileFieldError('contact.location')}>
              <input
                name="contact.location"
                value={profile.contact.location ?? ''}
                onChange={(event) => updateContact('location', event.target.value)}
                maxLength={100}
                className={inputClass}
              />
            </Field>
            <Field label="Website (HTTPS)" error={profileFieldError('contact.website')}>
              <input
                name="contact.website"
                type="url"
                placeholder="https://example.com"
                value={profile.contact.website ?? ''}
                onChange={(event) => updateContact('website', event.target.value)}
                className={inputClass}
              />
            </Field>
            <div className="space-y-4 border-t pt-4">
              <h3 className="font-semibold">Social links</h3>
              {socialPlatforms.map(({ value, label }) => (
                <Field
                  key={value}
                  label={`${label} URL`}
                  error={fieldErrors[`socialLinks.${value}`]}
                >
                  <input
                    name={`socialLinks.${value}`}
                    type="url"
                    placeholder="https://"
                    value={socialUrl(value)}
                    onChange={(event) => changeSocial(value, event.target.value)}
                    className={inputClass}
                  />
                </Field>
              ))}
            </div>
          </section>

          <section
            id="profile-images"
            className={step === 'images' ? 'app-card space-y-5 p-5 sm:p-7' : 'hidden'}
          >
            <SectionHeading
              title="Images and gallery"
              detail="Choose JPEG, PNG, or WebP files. Uploads are stored for this card."
            />
            {uploadError && (
              <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">
                {uploadError}
              </p>
            )}
            <CardImageControl
              kind="AVATAR"
              value={profile.avatar ?? ''}
              onChange={(url) => updateProfile('avatar', url || null)}
              onFile={handleImageChange('AVATAR', (url) => updateProfile('avatar', url))}
            />
            <CardImageControl
              kind="COVER"
              value={profile.cover ?? ''}
              onChange={(url) => updateProfile('cover', url || null)}
              onFile={handleImageChange('COVER', (url) => updateProfile('cover', url))}
            />
            <div className="border-t border-app-border pt-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-semibold">Gallery</h3>
                <span className="text-xs text-app-secondary">{profile.gallery.length} / 30</span>
              </div>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                aria-label="Add gallery image"
                disabled={profile.gallery.length >= 30}
                onChange={handleImageChange('GALLERY', (url) =>
                  updateProfile('gallery', [...profile.gallery, url]),
                )}
                className="app-control mt-3 file:mr-3 file:rounded-md file:border-0 file:bg-app-light file:px-3 file:py-2 file:text-xs file:font-semibold file:text-app-primary"
              />
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {profile.gallery.map((url, index) => (
                  <div
                    key={`${url}-${index}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-app-border"
                  >
                    <Image
                      src={url}
                      alt={`Gallery image ${index + 1}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                    <button
                      type="button"
                      aria-label={`Remove gallery image ${index + 1}`}
                      onClick={() =>
                        updateProfile(
                          'gallery',
                          profile.gallery.filter((_image, imageIndex) => imageIndex !== index),
                        )
                      }
                      className="absolute right-2 top-2 rounded-full bg-white px-3 py-2 text-xs font-semibold text-rose-700 shadow"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              {fieldErrors.gallery && <FieldError message={fieldErrors.gallery} />}
            </div>
          </section>

          <section className={step === 'office' ? 'app-card space-y-5 p-5 sm:p-7' : 'hidden'}>
            <SectionHeading
              title="Office details"
              detail="Turning this off hides office details publicly but keeps them saved."
            />
            <fieldset>
              <legend className="text-sm font-semibold">
                Do you have an office or work at one?
              </legend>
              <div className="mt-3 flex gap-3">
                <RadioChoice
                  label="Yes"
                  checked={office.hasOffice}
                  onChange={() => updateOfficeValue('hasOffice', true)}
                />
                <RadioChoice
                  label="No"
                  checked={!office.hasOffice}
                  onChange={() => updateOfficeValue('hasOffice', false)}
                />
              </div>
            </fieldset>
            {office.hasOffice && (
              <div className="space-y-4 border-t pt-4">
                <Field label="Company name" error={fieldErrors.companyName}>
                  <input
                    name="companyName"
                    value={office.companyName ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('companyName', event.target.value || null)
                    }
                    maxLength={160}
                    className={inputClass}
                  />
                </Field>
                <Field label="Designation" error={fieldErrors.designation}>
                  <input
                    name="designation"
                    value={office.designation ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('designation', event.target.value || null)
                    }
                    maxLength={100}
                    className={inputClass}
                  />
                </Field>
                <Field label="Department" error={fieldErrors.department}>
                  <input
                    name="department"
                    value={office.department ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('department', event.target.value || null)
                    }
                    maxLength={100}
                    className={inputClass}
                  />
                </Field>
                <Field label="Office address" error={fieldErrors.officeAddress}>
                  <textarea
                    name="officeAddress"
                    value={office.officeAddress ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('officeAddress', event.target.value || null)
                    }
                    maxLength={500}
                    rows={3}
                    className={inputClass}
                  />
                </Field>
                <Field label="Office phone" error={fieldErrors.officePhone}>
                  <input
                    name="officePhone"
                    type="tel"
                    value={office.officePhone ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('officePhone', event.target.value || null)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Office email" error={fieldErrors.officeEmail}>
                  <input
                    name="officeEmail"
                    type="email"
                    value={office.officeEmail ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('officeEmail', event.target.value || null)
                    }
                    className={inputClass}
                  />
                </Field>
                <Field label="Company website (HTTPS)" error={fieldErrors.companyWebsite}>
                  <input
                    name="companyWebsite"
                    type="url"
                    value={office.companyWebsite ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('companyWebsite', event.target.value || null)
                    }
                    placeholder="https://"
                    className={inputClass}
                  />
                </Field>
                <Field label="Working hours" error={fieldErrors.workingHours}>
                  <input
                    name="workingHours"
                    value={office.workingHours ?? ''}
                    onChange={(event) =>
                      updateOfficeValue('workingHours', event.target.value || null)
                    }
                    maxLength={160}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}
          </section>

          <section className={step === 'products' ? 'app-card space-y-5 p-5 sm:p-7' : 'hidden'}>
            <SectionHeading
              title="Products or services"
              detail="Add up to five products or services. Price is optional and is hidden when left blank."
            />
            <fieldset>
              <legend className="text-sm font-semibold">Do you offer products or services?</legend>
              <div className="mt-3 flex gap-3">
                <RadioChoice
                  label="Yes"
                  checked={showProducts}
                  onChange={() => {
                    setShowProducts(true);
                    setDirty(true);
                  }}
                />
                <RadioChoice
                  label="No"
                  checked={!showProducts}
                  onChange={() => {
                    setShowProducts(false);
                    setDirty(true);
                  }}
                />
              </div>
            </fieldset>
            {showProducts && (
              <div className="space-y-4 border-t pt-4">
                {products.length === 0 && (
                  <p className="rounded-lg bg-slate-50 p-4 text-sm text-slate-600">
                    No products or services yet. Add one to get started.
                  </p>
                )}
                {products.map((item, index) => (
                  <article
                    key={item.id ?? `new-${index}`}
                    className="space-y-3 rounded-xl border border-slate-200 p-4"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Product or service {index + 1}</h3>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          disabled={index === 0 || uploadsInProgress > 0}
                          onClick={() => reorderProduct(index, -1)}
                          className="min-h-10 rounded border px-3 text-sm disabled:opacity-40"
                          aria-label={`Move product or service ${index + 1} up`}
                        >
                          ↑
                        </button>
                        <button
                          type="button"
                          disabled={index === products.length - 1 || uploadsInProgress > 0}
                          onClick={() => reorderProduct(index, 1)}
                          className="min-h-10 rounded border px-3 text-sm disabled:opacity-40"
                          aria-label={`Move product or service ${index + 1} down`}
                        >
                          ↓
                        </button>
                        <button
                          type="button"
                          disabled={uploadsInProgress > 0}
                          onClick={() => removeProduct(index)}
                          className="min-h-10 rounded border border-rose-200 px-3 text-sm text-rose-700 disabled:opacity-40"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                    <ProductImageControl
                      name={`products.${index}.image`}
                      value={item.image}
                      error={fieldErrors[`products.${index}.image`]}
                      onChange={(url) => changeProduct(index, { image: url })}
                      onUpload={(file, onProgress) => uploadFile('PRODUCT', file, onProgress)}
                    />
                    <Field label="Name" error={fieldErrors[`products.${index}.name`]}>
                      <input
                        name={`products.${index}.name`}
                        value={item.name}
                        onChange={(event) => changeProduct(index, { name: event.target.value })}
                        maxLength={100}
                        placeholder="e.g. Logo design or Leather wallet"
                        className={inputClass}
                      />
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_7rem]">
                      <Field
                        label="Price (optional)"
                        error={fieldErrors[`products.${index}.price`]}
                      >
                        <input
                          name={`products.${index}.price`}
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price}
                          onChange={(event) => changeProduct(index, { price: event.target.value })}
                          className={inputClass}
                        />
                      </Field>
                      <Field label="Currency">
                        <input
                          value={item.currency}
                          onChange={(event) =>
                            changeProduct(index, { currency: event.target.value.toUpperCase() })
                          }
                          maxLength={3}
                          className={inputClass}
                        />
                      </Field>
                    </div>
                    <Field
                      label="Short description"
                      error={fieldErrors[`products.${index}.detail`]}
                    >
                      <input
                        name={`products.${index}.detail`}
                        value={item.detail}
                        onChange={(event) => changeProduct(index, { detail: event.target.value })}
                        maxLength={120}
                        placeholder="One short line about what you offer"
                        className={inputClass}
                      />
                    </Field>
                  </article>
                ))}
                {products.length < 5 && (
                  <button
                    type="button"
                    onClick={addProduct}
                    className="min-h-11 w-full rounded-lg border border-dashed border-slate-300 text-sm font-semibold text-indigo-700"
                  >
                    Add product or service
                  </button>
                )}
              </div>
            )}
          </section>

          <section className={step === 'theme' ? 'app-card space-y-5 p-5 sm:p-7' : 'hidden'}>
            <SectionHeading
              title="Theme color"
              detail="Choose an accent color for the public profile."
            />
            <ProfileTemplatePicker
              value={profile.templateId}
              savedValue={savedTemplateId}
              onChange={(templateId) => updateProfile('templateId', templateId)}
              previewData={previewData}
              hasAvatar={Boolean(profile.avatar)}
              hasCover={Boolean(profile.cover)}
              onGoToImages={() => {
                setStep('images');
                window.setTimeout(() => {
                  document
                    .querySelector<HTMLElement>('#profile-images input, #profile-images button')
                    ?.focus();
                }, 0);
              }}
            />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {PROFILE_THEME_PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  aria-pressed={profile.themeColor.toLowerCase() === preset.color.toLowerCase()}
                  onClick={() => updateProfile('themeColor', preset.color)}
                  className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium"
                >
                  <span
                    className="h-5 w-5 rounded-full border"
                    style={{ backgroundColor: preset.color }}
                  />
                  {preset.name}
                </button>
              ))}
            </div>
            <Field label="Custom hex color" error={profileFieldError('themeColor')}>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  aria-label="Choose a theme color"
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(profile.themeColor)
                      ? profile.themeColor
                      : DEFAULT_PROFILE_THEME_COLOR
                  }
                  onChange={(event) => updateProfile('themeColor', event.target.value)}
                  className="mt-1 h-11 w-14 rounded border p-1"
                />
                <input
                  name="themeColor"
                  value={profile.themeColor}
                  onChange={(event) => updateProfile('themeColor', event.target.value)}
                  maxLength={7}
                  className={inputClass}
                />
              </div>
            </Field>
          </section>

          {step === 'preview' && !widePreview && (
            <section className="app-card space-y-5 p-5">
              <SectionHeading
                title="Live preview"
                detail="This is the public profile as it will appear."
              />
              <TemplatePreviewStatus
                savedTemplateId={savedTemplateId}
                selectedTemplateId={profile.templateId}
                disabled={saving || uploadsInProgress > 0}
                onRestore={restoreSavedTemplate}
              />
              <div className="profile-preview-frame overflow-hidden rounded-xl border border-app-border bg-white">
                <ProfilePreviewFrame data={previewData} />
              </div>
              {!profile.avatar || !profile.cover ? (
                <p className="text-xs text-slate-600">
                  Add a photo to see it at its best.{' '}
                  <button
                    type="button"
                    className="font-semibold text-indigo-700 underline"
                    onClick={() => setStep('images')}
                  >
                    Add photos
                  </button>
                </p>
              ) : null}
            </section>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={currentStepIndex === 0}
              onClick={() => setStep(STEPS[Math.max(0, currentStepIndex - 1)]!.id)}
              className="min-h-11 rounded-lg border px-4 text-sm font-semibold disabled:opacity-40"
            >
              Back
            </button>
            {step !== 'preview' && (
              <button
                type="button"
                onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, currentStepIndex + 1)]!.id)}
                className="min-h-11 rounded-lg bg-slate-900 px-4 text-sm font-semibold text-white"
              >
                Next
              </button>
            )}
          </div>

          <div className="sticky bottom-0 z-20 mt-5 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border border-app-border bg-white/95 p-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] shadow-[0_-8px_24px_rgba(15,23,42,0.06)] backdrop-blur sm:rounded-xl sm:p-4">
            <div className="min-w-0 text-sm">
              {success && (
                <p role="status" className="font-semibold text-emerald-700">
                  {success}
                </p>
              )}
              {dirty && !success && (
                <p role="status" className="font-semibold text-amber-700">
                  Unsaved changes
                </p>
              )}
              {uploadsInProgress > 0 && (
                <p role="status" className="font-medium text-slate-600">
                  Uploading image. Saving will be available when it finishes.
                </p>
              )}
              {serverError && (
                <p role="alert" className="font-semibold text-rose-700">
                  {serverError === 'Please fix the highlighted fields'
                    ? serverError
                    : `Could not save. ${serverError}`}
                </p>
              )}
              {success && (
                <a
                  href={publicHref}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1 inline-block font-semibold text-indigo-700 underline"
                >
                  View public profile
                </a>
              )}
            </div>
            <button
              type="submit"
              form="card-profile-form"
              disabled={saving || uploadsInProgress > 0}
              className="app-button-primary min-w-32 px-5"
            >
              {saving
                ? 'Saving…'
                : uploadsInProgress > 0
                  ? 'Uploading image…'
                  : serverError && serverError !== 'Please fix the highlighted fields'
                    ? 'Retry save'
                    : 'Save card profile'}
            </button>
          </div>
        </form>

        {widePreview && (
          <aside className="min-w-0 xl:sticky xl:top-5">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Live preview
            </h2>
            <TemplatePreviewStatus
              savedTemplateId={savedTemplateId}
              selectedTemplateId={profile.templateId}
              disabled={saving || uploadsInProgress > 0}
              onRestore={restoreSavedTemplate}
            />
            <div className="profile-preview-frame mt-2 max-h-[calc(100vh-9rem)] overflow-auto rounded-2xl border border-app-border bg-white shadow-sm">
              <ProfilePreviewFrame data={previewData} />
            </div>
            {!profile.avatar || !profile.cover ? (
              <p className="mt-2 text-xs text-slate-600">
                Add a photo to see it at its best.{' '}
                <button
                  type="button"
                  className="font-semibold text-indigo-700 underline"
                  onClick={() => setStep('images')}
                >
                  Add photos
                </button>
              </p>
            ) : null}
          </aside>
        )}
      </div>
    </div>
  );
}

function TemplatePreviewStatus({
  savedTemplateId,
  selectedTemplateId,
  disabled,
  onRestore,
}: {
  savedTemplateId: CardProfileData['templateId'];
  selectedTemplateId: CardProfileData['templateId'];
  disabled: boolean;
  onRestore: () => void;
}) {
  const isDifferent = savedTemplateId !== selectedTemplateId;
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
      <p className="font-medium">Saved template: {templateName(savedTemplateId)}</p>
      {isDifferent && (
        <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
          <p>Previewing: {templateName(selectedTemplateId)} (not saved)</p>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              form="card-profile-form"
              disabled={disabled}
              className="min-h-11 rounded-lg bg-slate-900 px-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Save
            </button>
            <button
              type="button"
              onClick={onRestore}
              className="min-h-11 rounded-lg border border-slate-300 px-3 font-semibold"
            >
              Back to saved
            </button>
          </div>
          <p className="sr-only" aria-live="polite">
            Previewing {templateName(selectedTemplateId)}, not saved yet
          </p>
        </div>
      )}
    </div>
  );
}

function templateName(templateId: CardProfileData['templateId']): string {
  return PROFILE_TEMPLATE_OPTIONS.find((option) => option.id === templateId)?.name ?? 'Default';
}

function buildProfilePreviewData(
  slug: string,
  profile: CardProfileData,
  office: CardOffice,
  products: ProductDraft[],
  showProducts: boolean,
): ProfilePreviewData | null {
  const safeHttpsUrl = (value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
      return new URL(value).protocol === 'https:' ? value : null;
    } catch {
      return null;
    }
  };
  const socialLinks = profile.socialLinks.filter(
    (link) => CardSocialLinkSchema.safeParse(link).success,
  );
  const profileResult = PublicProfileApiSchema.safeParse({
    ...toPublicProfile(slug, profile),
    slug: CardSlugSchema.safeParse(slug).success ? slug : 'preview-profile',
    fullName: profile.fullName.trim().length >= 2 ? profile.fullName : 'Your name',
    avatar: safeHttpsUrl(profile.avatar),
    coverImage: safeHttpsUrl(profile.cover),
    email: z.string().email().safeParse(profile.contact.email).success
      ? profile.contact.email
      : null,
    website: safeHttpsUrl(profile.contact.website),
    linkedinUrl:
      safeHttpsUrl(socialLinks.find((link) => link.platform === 'LINKEDIN')?.url) ?? null,
    githubUrl: safeHttpsUrl(socialLinks.find((link) => link.platform === 'GITHUB')?.url) ?? null,
    galleryImages: profile.gallery.flatMap((url) => {
      const safeUrl = safeHttpsUrl(url);
      return safeUrl ? [{ url: safeUrl, alt: '', caption: null }] : [];
    }),
    socialLinks,
    themeColor: /^#[0-9a-fA-F]{6}$/.test(profile.themeColor)
      ? profile.themeColor
      : DEFAULT_PROFILE_THEME_COLOR,
  });
  if (!profileResult.success) return null;

  const officeResult = CardOfficeSchema.safeParse(office);
  const previewProducts = products.flatMap((product, index) => {
    const parsed = CardProductResponseSchema.safeParse({
      id:
        product.id && z.string().uuid().safeParse(product.id).success
          ? product.id
          : `00000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`,
      sortOrder: index,
      image: safeHttpsUrl(product.image) ?? '',
      name: product.name,
      price: product.price.trim() ? Number(product.price) : null,
      currency: product.currency,
      detail: product.detail,
    });
    return parsed.success ? [parsed.data] : [];
  });
  const result = ProfilePreviewDataSchema.safeParse({
    profile: profileResult.data,
    office: officeResult.success ? officeResult.data : null,
    products: previewProducts,
    showProducts,
  });
  return result.success ? result.data : null;
}

function isDraftEqualToCard(
  card: UserCard,
  details: CardData,
  profile: CardProfileData,
  office: CardOffice,
  products: ProductDraft[],
): boolean {
  const savedOffice = CardOfficeSchema.parse(card.office ?? { hasOffice: false });
  const savedProducts = card.products.map((item) => ({
    id: item.id,
    image: item.image,
    name: item.name,
    price: item.price == null ? '' : String(item.price),
    currency: item.currency,
    detail: item.detail,
  }));
  return (
    JSON.stringify(details) ===
      JSON.stringify({
        slug: card.slug,
        purpose: card.purpose,
        ...(card.customPurpose ? { customPurpose: card.customPurpose } : {}),
      }) &&
    JSON.stringify(profile) === JSON.stringify(card.profile) &&
    JSON.stringify(office) === JSON.stringify(savedOffice) &&
    JSON.stringify(products) === JSON.stringify(savedProducts)
  );
}

function CardImageControl({
  kind,
  value,
  onChange,
  onFile,
}: {
  kind: 'AVATAR' | 'COVER';
  value: string;
  onChange: (value: string) => void;
  onFile: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="app-card p-4">
      <label className="block text-sm font-semibold">
        {kind === 'AVATAR' ? 'Profile photo' : 'Cover image'}
      </label>
      {value && (
        <div
          className={`relative mt-3 overflow-hidden rounded-lg ${kind === 'AVATAR' ? 'h-24 w-24 rounded-full' : 'h-36 w-full'}`}
        >
          <Image
            src={value}
            alt={kind === 'AVATAR' ? 'Card profile photo' : 'Card cover'}
            fill
            unoptimized
            className="object-cover"
          />
        </div>
      )}
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`Upload ${kind.toLowerCase()}`}
        onChange={onFile}
        className="app-control mt-3 file:mr-3 file:rounded-md file:border-0 file:bg-app-light file:px-3 file:py-2 file:text-xs file:font-semibold file:text-app-primary"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="mt-2 min-h-10 text-sm text-rose-700 underline"
        >
          Remove image
        </button>
      )}
    </div>
  );
}

function ProductImageControl({
  name,
  value,
  error,
  onChange,
  onUpload,
}: {
  name: string;
  value: string;
  error?: string;
  onChange: (url: string) => void;
  onUpload: (file: File, onProgress: (progress: number) => void) => Promise<string>;
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!previewUrl) return;
    return () => URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  async function uploadSelectedFile(file: File | undefined) {
    if (!file || uploading) return;
    setUploadError('');
    setProgress(0);
    setPreviewUrl(URL.createObjectURL(file));
    setUploading(true);
    try {
      const url = await onUpload(file, setProgress);
      onChange(url);
      setPreviewUrl(null);
    } catch (cause) {
      const message = getImageUploadErrorMessage(cause);
      setUploadError(message);
      if (value) setPreviewUrl(null);
      window.dispatchEvent(new CustomEvent('app-toast', { detail: { message, tone: 'error' } }));
    } finally {
      setUploading(false);
    }
  }

  function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    void uploadSelectedFile(file);
  }

  const imageSrc = previewUrl ?? value;
  const errorId = `${name}-error`;

  return (
    <div>
      <div
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          if (!uploading) void uploadSelectedFile(event.dataTransfer.files[0]);
        }}
        data-field={name}
        tabIndex={-1}
        className={`rounded-xl border border-dashed bg-white p-3 transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-app-focus ${error ? 'border-rose-400' : 'border-app-border'}`}
      >
        <label htmlFor={`${name}-file`} className="block cursor-pointer text-sm font-medium">
          Photo
          {imageSrc ? (
            <span className="relative mt-2 block h-36 w-36 overflow-hidden rounded-xl border border-app-border bg-app-background">
              <Image
                src={imageSrc}
                alt="Product or service photo preview"
                fill
                unoptimized
                className="object-cover"
              />
            </span>
          ) : (
            <span className="mt-2 flex min-h-24 items-center justify-center rounded-xl bg-app-background text-sm text-app-secondary">
              Drop an image here or tap to choose
            </span>
          )}
        </label>
        <input
          id={`${name}-file`}
          name={name}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          disabled={uploading}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          onChange={chooseFile}
          className="sr-only"
        />
        <p className="mt-2 text-xs text-app-secondary">JPG, PNG or WebP, up to 3 MB.</p>
        {uploading && (
          <div className="mt-3" role="status" aria-live="polite">
            <div className="mb-1 flex justify-between text-xs text-app-secondary">
              <span>Uploading photo</span>
              <span>{progress}%</span>
            </div>
            <div
              role="progressbar"
              aria-label="Photo upload progress"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              className="h-2 overflow-hidden rounded-full bg-slate-200"
            >
              <div
                className="h-full bg-app-primary transition-[width]"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}
        {imageSrc && !uploading && (
          <button
            type="button"
            onClick={() => {
              setPreviewUrl(null);
              setUploadError('');
              onChange('');
            }}
            className="mt-2 min-h-11 rounded-lg border border-rose-200 bg-white px-3 text-sm font-semibold text-rose-700"
          >
            Remove photo
          </button>
        )}
        {uploadError && (
          <p role="alert" className="mt-2 text-sm text-rose-700">
            {uploadError}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="mt-2 text-sm text-rose-700">
            {error}
          </p>
        )}
      </div>
      <label
        htmlFor={`${name}-file`}
        className="app-button-secondary mt-2 inline-flex cursor-pointer"
      >
        {uploading ? 'Uploading…' : imageSrc ? 'Replace photo' : 'Choose photo'}
      </label>
    </div>
  );
}

function toPublicProfile(slug: string, profile: CardProfileData): PublicProfileApi {
  const link = (platform: SocialPlatform) =>
    profile.socialLinks.find((item) => item.platform === platform)?.url ?? null;
  return {
    slug,
    fullName: profile.fullName || 'Your name',
    jobTitle: profile.jobTitle ?? null,
    skillsLine: profile.skillsLine ?? null,
    tagline: profile.tagline ?? null,
    avatar: profile.avatar ?? null,
    coverImage: profile.cover ?? null,
    phone: profile.contact.phone ?? null,
    email: profile.contact.email ?? null,
    location: profile.contact.location ?? null,
    website: profile.contact.website ?? null,
    linkedinUrl: link('LINKEDIN'),
    githubUrl: link('GITHUB'),
    galleryImages: profile.gallery.map((url) => ({ url, alt: '', caption: null })),
    themeColor: profile.themeColor,
    templateId: profile.templateId,
    isIndexable: false,
    socialLinks: profile.socialLinks,
  };
}

function stepForField(field: string): StepId {
  if (field.startsWith('contact.') || field.startsWith('socialLinks')) return 'contact';
  if (field.startsWith('avatar') || field.startsWith('cover') || field.startsWith('gallery'))
    return 'images';
  if (
    field.startsWith('company') ||
    field.startsWith('office') ||
    field.startsWith('workingHours') ||
    field === 'designation' ||
    field === 'department'
  )
    return 'office';
  if (field.startsWith('products')) return 'products';
  if (field === 'themeColor') return 'theme';
  if (field === 'purpose' || field === 'slug' || field === 'customPurpose') return 'basic';
  return 'basic';
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{detail}</p>
    </div>
  );
}

function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-sm font-medium">
      {label}
      {hint && <span className="mt-1 block text-xs font-normal text-slate-500">{hint}</span>}
      {children}
      {error && <FieldError message={error} />}
    </label>
  );
}

function FieldError({ message }: { message: string }) {
  return (
    <span role="alert" className="mt-1 block text-xs font-medium text-rose-700">
      {message}
    </span>
  );
}

function RadioChoice({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex min-h-12 flex-1 cursor-pointer items-center gap-3 rounded-lg border px-4 text-sm font-medium ${checked ? 'border-indigo-500 bg-indigo-50' : 'border-slate-300'}`}
    >
      <input
        type="radio"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 accent-indigo-600"
      />
      {label}
    </label>
  );
}

function EmptyCardState() {
  return (
    <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center">
      <h1 className="text-xl font-bold">No cards yet</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
        A card must be added to your account before you can customize its profile.
      </p>
      <a
        href="/dashboard/account"
        className="mt-5 inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold"
      >
        Go to account
      </a>
    </section>
  );
}

function ErrorMessage({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="rounded-xl bg-rose-50 p-4 text-sm text-rose-800">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-2 min-h-10 underline">
        Retry
      </button>
    </div>
  );
}
