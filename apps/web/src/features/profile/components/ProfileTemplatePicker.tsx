'use client';

import Image from 'next/image';
import React, { useEffect, useRef, useState } from 'react';
import {
  PROFILE_TEMPLATE_OPTIONS,
  type ProfileTemplateId,
  type ProfilePreviewData,
} from '@nfc/shared';
import { ProfileTemplatePreviewDialog } from './ProfileTemplatePreviewDialog';

export function ProfileTemplatePicker({
  value,
  savedValue,
  onChange,
  previewData = null,
  hasAvatar = false,
  hasCover = false,
  onGoToImages,
}: {
  value: ProfileTemplateId | null;
  savedValue: ProfileTemplateId | null;
  onChange: (templateId: ProfileTemplateId | null) => void;
  previewData?: ProfilePreviewData | null;
  hasAvatar?: boolean;
  hasCover?: boolean;
  onGoToImages?: () => void;
}) {
  const [previewOption, setPreviewOption] = useState<
    (typeof PROFILE_TEMPLATE_OPTIONS)[number] | null
  >(null);
  const previewTrigger = useRef<HTMLButtonElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  useEffect(() => {
    if (!previewOption) previewTrigger.current?.focus();
  }, [previewOption]);

  function closePreview() {
    setPreviewOption(null);
  }

  function usePreviewTemplate() {
    if (!previewOption) return;
    onChange(previewOption.id);
    closePreview();
  }

  function selectByKeyboard(index: number, event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key))
      return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? PROFILE_TEMPLATE_OPTIONS.length - 1
          : (index +
              (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) +
              PROFILE_TEMPLATE_OPTIONS.length) %
            PROFILE_TEMPLATE_OPTIONS.length;
    const option = PROFILE_TEMPLATE_OPTIONS[nextIndex];
    if (!option) return;
    onChange(option.id);
    optionRefs.current[nextIndex]?.focus();
  }

  const modalPreviewData =
    previewOption && previewData
      ? {
          ...previewData,
          profile: { ...previewData.profile, templateId: previewOption.id },
        }
      : null;
  const isUnsaved = value !== savedValue;

  return (
    <>
      <fieldset>
        <legend className="text-sm font-semibold">Public profile design</legend>
        <p className="mt-1 text-sm text-slate-600">
          Choose how this card’s public portfolio is presented.
        </p>
        <div
          role="status"
          aria-live="polite"
          className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
        >
          <span className="font-medium">Saved template: {templateName(savedValue)}</span>
          {isUnsaved && (
            <>
              <span className="text-slate-600">Previewing: {templateName(value)} (not saved)</span>
              <span className="sr-only">Previewing {templateName(value)}, not saved yet</span>
            </>
          )}
        </div>
        <div
          role="radiogroup"
          aria-label="Public profile design"
          className="mt-3 grid grid-cols-2 gap-2.5 md:grid-cols-3 lg:grid-cols-4"
        >
          {PROFILE_TEMPLATE_OPTIONS.map((option, index) => (
            <div
              key={option.id ?? 'default'}
              className={`relative flex h-[224px] flex-col items-center rounded-xl border p-2 text-center transition-colors ${
                value === option.id
                  ? 'border-app-primary bg-app-light ring-2 ring-app-primary ring-offset-1'
                  : 'border-app-border bg-white hover:bg-slate-50'
              }`}
            >
              <button
                ref={(element) => {
                  optionRefs.current[index] = element;
                }}
                type="button"
                role="radio"
                aria-checked={value === option.id}
                aria-label={`${option.name}. ${option.description}${
                  savedValue === option.id ? ' Saved' : ''
                }${value === option.id ? '. Selected for draft' : ''}`}
                tabIndex={value === option.id ? 0 : -1}
                onKeyDown={(event) => selectByKeyboard(index, event)}
                onClick={() => onChange(option.id)}
                className="absolute inset-0 z-0 rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--app-focus)]"
              />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-2 top-2 z-10 flex justify-between"
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                    value === option.id
                      ? 'border-indigo-700 bg-indigo-700'
                      : 'border-slate-400 bg-white'
                  }`}
                >
                  {value === option.id && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                {savedValue === option.id && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-800 shadow-sm">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3.5 w-3.5"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      aria-hidden="true"
                    >
                      <path d="m3 8 3 3 7-7" />
                    </svg>
                    Saved
                  </span>
                )}
              </div>
              <div
                aria-hidden="true"
                className="pointer-events-none relative z-10 flex w-full flex-1 flex-col items-center pt-6"
              >
                <Image
                  src={option.thumbnail}
                  alt=""
                  width={320}
                  height={200}
                  loading="lazy"
                  sizes="(max-width: 767px) 112px, 120px"
                  className="aspect-[8/5] w-full max-w-[112px] rounded-lg object-cover"
                />
                <span className="mt-2 block max-w-full truncate text-sm font-semibold">
                  {option.name}
                </span>
                <span className="mt-1 h-8 line-clamp-2 text-xs leading-4 text-app-secondary">
                  {option.description.length > 60
                    ? `${option.description.slice(0, 57).trimEnd()}…`
                    : option.description}
                </span>
              </div>
              {onGoToImages && (
                <button
                  ref={(element) => {
                    if (element && option === previewOption) previewTrigger.current = element;
                  }}
                  type="button"
                  onClick={(event) => {
                    previewTrigger.current = event.currentTarget;
                    setPreviewOption(option);
                  }}
                  className="relative z-20 mt-1 inline-flex min-h-11 items-center justify-center rounded-md px-3 text-sm font-semibold text-indigo-700 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                >
                  Preview
                </button>
              )}
            </div>
          ))}
        </div>
      </fieldset>
      {previewOption && (
        <ProfileTemplatePreviewDialog
          templateName={previewOption.name}
          data={modalPreviewData}
          missingPhotos={!hasAvatar || !hasCover}
          onClose={closePreview}
          onUseTemplate={usePreviewTemplate}
          onAddPhotos={() => {
            closePreview();
            onGoToImages?.();
          }}
        />
      )}
    </>
  );
}

function templateName(templateId: ProfileTemplateId | null): string {
  return PROFILE_TEMPLATE_OPTIONS.find((option) => option.id === templateId)?.name ?? 'Default';
}
