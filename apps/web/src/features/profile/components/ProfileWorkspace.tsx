'use client';

import Image from 'next/image';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  DEFAULT_PROFILE_THEME_COLOR,
  MAX_PROFILE_GALLERY_IMAGES,
  PROFILE_THEME_PRESETS,
  ProfileDataSchema,
  ProfileDataUpdateSchema,
  generateProfileThemePalette,
  profileThemeCssVariables,
  type ProfileData,
} from '@nfc/shared';
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import type { z } from 'zod';
import { ImageUpload } from '@/features/profile/components/ImageUpload';
import { deleteGalleryEntry, type GalleryEntry } from '@/lib/api/uploads';
import { GALLERY_QUERY_KEY, useGallery, useProfile, useUpdateProfile } from '../hooks/useProfile';
import type { Profile } from '../types/profile';
import { useQueryClient } from '@tanstack/react-query';

type ProfileFormInput = z.input<typeof ProfileDataSchema>;

const inputClass =
  'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500';

export function ProfileWorkspace({ initial }: { initial: Profile }) {
  const { data: profile = initial } = useProfile(initial);
  const gallery = useGallery();
  const queryClient = useQueryClient();
  const updateProfile = useUpdateProfile();
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [deletingGalleryId, setDeletingGalleryId] = useState<string | null>(null);

  const defaultValues = useMemo<ProfileFormInput>(
    () => ({
      fullName: profile.fullName ?? '',
      jobTitle: profile.jobTitle ?? '',
      skillsLine: profile.skillsLine ?? '',
      tagline: profile.tagline ?? '',
      avatar: profile.avatar ?? '',
      coverImage: profile.coverImage ?? '',
      galleryImages: [],
      phone: profile.phone ?? '',
      email: profile.email ?? '',
      location: profile.location ?? '',
      website: profile.website ?? '',
      linkedinUrl: profile.linkedinUrl ?? '',
      githubUrl: profile.githubUrl ?? '',
      themeColor: profile.themeColor ?? DEFAULT_PROFILE_THEME_COLOR,
      slug: profile.slug,
    }),
    [profile],
  );

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors, isSubmitting, isValid },
  } = useForm<ProfileFormInput, undefined, ProfileData>({
    resolver: zodResolver(ProfileDataSchema),
    defaultValues,
    mode: 'onChange',
  });
  const values = useWatch({ control });
  const themeColor =
    typeof values.themeColor === 'string' ? values.themeColor : DEFAULT_PROFILE_THEME_COLOR;
  const palette = useMemo(() => generateProfileThemePalette(themeColor), [themeColor]);
  const galleryImages = gallery.data ?? EMPTY_GALLERY;
  const currentGalleryUrls = useMemo(
    () => galleryImages.map((image) => image.url),
    [galleryImages],
  );

  useEffect(() => {
    reset(defaultValues);
  }, [defaultValues, reset]);

  useEffect(() => {
    if (gallery.isSuccess) {
      setValue('galleryImages', currentGalleryUrls, { shouldValidate: true });
    }
  }, [currentGalleryUrls, gallery.isSuccess, setValue]);

  async function save(data: ProfileData) {
    setErrorMessage('');
    setMessage('');
    try {
      const profilePatch = ProfileDataUpdateSchema.parse(data);
      await updateProfile.mutateAsync(profilePatch);
      setMessage('Your profile has been saved.');
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not save your profile.');
    }
  }

  async function removeGalleryImage(image: GalleryEntry) {
    setDeletingGalleryId(image.id);
    setErrorMessage('');
    try {
      await deleteGalleryEntry(image.id);
      await queryClient.invalidateQueries({ queryKey: GALLERY_QUERY_KEY });
      setMessage('Gallery image removed.');
    } catch (cause) {
      setErrorMessage(cause instanceof Error ? cause.message : 'Could not remove this image.');
    } finally {
      setDeletingGalleryId(null);
    }
  }

  function setImage(field: 'avatar' | 'coverImage', url: string | null) {
    setValue(field, url ?? '', { shouldDirty: true, shouldValidate: true });
  }

  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <form onSubmit={handleSubmit(save)} noValidate className="space-y-8">
        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Your profile</h2>
            <p className="mt-1 text-sm text-slate-600">
              Fill in the details you want to share. Empty fields stay hidden on your profile.
            </p>
          </div>

          <Field label="Full name" htmlFor="fullName" error={errors.fullName?.message}>
            <input
              id="fullName"
              autoComplete="name"
              maxLength={100}
              {...register('fullName')}
              className={inputClass}
            />
          </Field>
          <Field label="Job title" htmlFor="jobTitle" error={errors.jobTitle?.message}>
            <input id="jobTitle" maxLength={100} {...register('jobTitle')} className={inputClass} />
          </Field>
          <Field
            label="Skills"
            htmlFor="skillsLine"
            hint="Enter up to 3 skills, separated by commas or vertical bars."
            error={errors.skillsLine?.message}
          >
            <input
              id="skillsLine"
              maxLength={120}
              {...register('skillsLine')}
              className={inputClass}
            />
          </Field>
          <Field label="Tagline" htmlFor="tagline" error={errors.tagline?.message}>
            <input id="tagline" maxLength={80} {...register('tagline')} className={inputClass} />
          </Field>
          <Field
            label="Public profile URL"
            htmlFor="slug"
            hint="Use 3–30 lowercase letters, numbers, and hyphens."
            error={errors.slug?.message}
          >
            <div className="flex items-center gap-2">
              <span className="mt-1 shrink-0 rounded-lg bg-slate-100 px-3 py-3 text-sm text-slate-600">
                /u/
              </span>
              <input
                id="slug"
                autoComplete="off"
                maxLength={30}
                {...register('slug')}
                className={inputClass}
              />
            </div>
          </Field>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Images</h2>
            <p className="mt-1 text-sm text-slate-600">
              JPEG, PNG, or WebP. Avatar and cover are cropped to fit.
            </p>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Avatar</p>
            <ImageUpload
              kind="AVATAR"
              currentUrl={typeof values.avatar === 'string' ? values.avatar : null}
              onUploaded={(url) => setImage('avatar', url)}
              onDeleted={() => setImage('avatar', null)}
            />
            {errors.avatar?.message && <FieldError>{errors.avatar.message}</FieldError>}
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Cover image</p>
            <ImageUpload
              kind="COVER"
              currentUrl={typeof values.coverImage === 'string' ? values.coverImage : null}
              onUploaded={(url) => setImage('coverImage', url)}
              onDeleted={() => setImage('coverImage', null)}
            />
            {errors.coverImage?.message && <FieldError>{errors.coverImage.message}</FieldError>}
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-700">Gallery</p>
              <span className="text-xs text-slate-500">
                {galleryImages.length} / {MAX_PROFILE_GALLERY_IMAGES}
              </span>
            </div>
            <ImageUpload
              kind="GALLERY"
              disabled={galleryImages.length >= MAX_PROFILE_GALLERY_IMAGES}
              onUploaded={() => {
                void queryClient.invalidateQueries({ queryKey: GALLERY_QUERY_KEY });
              }}
            />
            {gallery.isPending && <p className="mt-2 text-sm text-slate-500">Loading gallery…</p>}
            {gallery.isError && (
              <div role="alert" className="mt-2 text-sm text-rose-700">
                Could not load your gallery.{' '}
                <button type="button" className="underline" onClick={() => void gallery.refetch()}>
                  Try again
                </button>
              </div>
            )}
            {galleryImages.length > 0 && (
              <ul className="mt-4 grid grid-cols-3 gap-3 sm:grid-cols-4">
                {galleryImages.map((image) => (
                  <li
                    key={image.id}
                    className="relative overflow-hidden rounded-lg border border-slate-200"
                  >
                    <Image
                      src={image.url}
                      alt={image.altText || 'Gallery image'}
                      width={240}
                      height={180}
                      unoptimized
                      className="aspect-square w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => void removeGalleryImage(image)}
                      disabled={deletingGalleryId === image.id}
                      aria-label={`Remove ${image.altText || 'gallery image'}`}
                      className="absolute right-1 top-1 min-h-11 min-w-11 rounded-full bg-white/95 text-sm font-semibold text-rose-700 shadow disabled:opacity-50"
                    >
                      {deletingGalleryId === image.id ? '…' : '×'}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {errors.galleryImages?.message && (
              <FieldError>{errors.galleryImages.message}</FieldError>
            )}
          </div>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Contact and social</h2>
            <p className="mt-1 text-sm text-slate-600">
              Only populated contact details are shown publicly.
            </p>
          </div>
          <Field
            label="Phone"
            htmlFor="phone"
            hint="Use international format, for example +94771234567."
            error={errors.phone?.message}
          >
            <input
              id="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              {...register('phone')}
              className={inputClass}
            />
          </Field>
          <Field label="Email" htmlFor="email" error={errors.email?.message}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              maxLength={254}
              {...register('email')}
              className={inputClass}
            />
          </Field>
          <Field label="Location" htmlFor="location" error={errors.location?.message}>
            <input id="location" maxLength={100} {...register('location')} className={inputClass} />
          </Field>
          <Field label="Website (HTTPS)" htmlFor="website" error={errors.website?.message}>
            <input
              id="website"
              type="url"
              placeholder="https://example.com"
              {...register('website')}
              className={inputClass}
            />
          </Field>
          <Field label="LinkedIn URL" htmlFor="linkedinUrl" error={errors.linkedinUrl?.message}>
            <input
              id="linkedinUrl"
              type="url"
              placeholder="https://linkedin.com/in/you"
              {...register('linkedinUrl')}
              className={inputClass}
            />
          </Field>
          <Field label="GitHub URL" htmlFor="githubUrl" error={errors.githubUrl?.message}>
            <input
              id="githubUrl"
              type="url"
              placeholder="https://github.com/you"
              {...register('githubUrl')}
              className={inputClass}
            />
          </Field>
        </section>

        <section className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Theme color</h2>
            <p className="mt-1 text-sm text-slate-600">
              One color automatically creates your buttons, links, badges, avatar ring, and accents.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PROFILE_THEME_PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                aria-pressed={themeColor.toLowerCase() === preset.color.toLowerCase()}
                onClick={() =>
                  setValue('themeColor', preset.color, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left text-sm font-medium text-slate-800 hover:border-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                style={{ outlineColor: preset.color }}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border border-black/10"
                  style={{ backgroundColor: preset.color }}
                />
                {preset.name}
              </button>
            ))}
          </div>
          <Field label="Custom hex color" htmlFor="themeColor" error={errors.themeColor?.message}>
            <div className="flex items-center gap-3">
              <input
                type="color"
                aria-label="Choose a custom theme color"
                value={
                  /^#[0-9a-fA-F]{6}$/.test(themeColor) ? themeColor : DEFAULT_PROFILE_THEME_COLOR
                }
                onChange={(event) =>
                  setValue('themeColor', event.target.value, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
                className="mt-1 h-11 w-14 rounded border border-slate-300 p-1"
              />
              <input
                id="themeColor"
                maxLength={7}
                {...register('themeColor')}
                className={inputClass}
              />
            </div>
          </Field>
          {palette.needsAdjustment && (
            <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
              This color was adjusted slightly to keep buttons and links readable.
            </p>
          )}
        </section>

        <div className="space-y-3">
          <button
            type="submit"
            disabled={!isValid || isSubmitting || updateProfile.isPending}
            className="min-h-12 w-full rounded-xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            style={{ backgroundColor: palette.buttonFill, color: palette.buttonText }}
          >
            {isSubmitting || updateProfile.isPending ? 'Saving…' : 'Save profile'}
          </button>
          {message && (
            <p role="status" className="text-sm text-emerald-700">
              {message}
            </p>
          )}
          {errorMessage && (
            <p role="alert" className="text-sm text-rose-700">
              {errorMessage}
            </p>
          )}
        </div>
      </form>

      <aside className="xl:sticky xl:top-6 xl:self-start">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Live preview
        </h2>
        <div
          style={profileThemeCssVariables(palette) as CSSProperties}
          className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3 text-slate-900 shadow-sm"
        >
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="relative h-28 bg-slate-100">
              {typeof values.coverImage === 'string' && values.coverImage && (
                <Image
                  src={values.coverImage}
                  alt="Cover preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
              )}
              {typeof values.tagline === 'string' && values.tagline && (
                <p className="absolute inset-x-3 bottom-3 z-10 line-clamp-2 text-sm font-semibold text-white drop-shadow [text-shadow:0_1px_4px_rgb(0_0_0_/_0.8)]">
                  {values.tagline}
                </p>
              )}
            </div>
            <div className="px-4 pb-5">
              <div className="-mt-9 flex h-[4.5rem] w-[4.5rem] items-center justify-center overflow-hidden rounded-full border-4 border-white bg-white shadow">
                {typeof values.avatar === 'string' && values.avatar ? (
                  <Image
                    src={values.avatar}
                    alt="Avatar preview"
                    width={72}
                    height={72}
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span
                    className="flex h-full w-full items-center justify-center rounded-full border-2 text-lg font-bold"
                    style={{ borderColor: palette.ring, color: palette.icon }}
                  >
                    {(typeof values.fullName === 'string'
                      ? values.fullName.charAt(0)
                      : '•'
                    ).toUpperCase()}
                  </span>
                )}
              </div>
              <p className="mt-3 text-xl font-bold">{values.fullName || 'Your name'}</p>
              {typeof values.jobTitle === 'string' && values.jobTitle && (
                <p className="mt-1 text-sm text-slate-600">{values.jobTitle}</p>
              )}
              {typeof values.skillsLine === 'string' && values.skillsLine && (
                <p className="mt-1 text-xs text-slate-500">{values.skillsLine}</p>
              )}
              <button
                type="button"
                tabIndex={-1}
                className="mt-4 min-h-11 w-full rounded-lg px-3 text-sm font-semibold"
                style={{ backgroundColor: palette.buttonFill, color: palette.buttonText }}
              >
                Download Contact (CSV)
              </button>
              <div className="mt-4 grid grid-cols-2 gap-2">
                {[
                  ['Phone', values.phone],
                  ['Email', values.email],
                  ['Location', values.location],
                  ['Website', values.website],
                ]
                  .filter((entry) => typeof entry[1] === 'string' && entry[1] !== '')
                  .map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-slate-200 p-2">
                      <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">
                        {label}
                      </p>
                      <p className="truncate text-xs">{value}</p>
                    </div>
                  ))}
              </div>
              {galleryImages.length > 0 && (
                <div className="mt-4 grid grid-cols-3 gap-1">
                  {galleryImages.slice(0, 3).map((image) => (
                    <Image
                      key={image.id}
                      src={image.url}
                      alt={image.altText || 'Gallery preview'}
                      width={120}
                      height={120}
                      unoptimized
                      className="aspect-square w-full object-cover"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

function FieldError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="mt-1 text-sm text-rose-700">
      {children}
    </p>
  );
}

const EMPTY_GALLERY: GalleryEntry[] = [];
