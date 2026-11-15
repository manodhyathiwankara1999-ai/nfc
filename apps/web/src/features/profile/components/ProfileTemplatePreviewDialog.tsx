'use client';

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import type { ProfilePreviewData } from '@nfc/shared';
import { ProfilePreviewFrame } from './ProfilePreviewFrame';

const DEVICES = [
  { label: 'Mobile', width: 390, height: 844 },
  { label: 'Tablet', width: 820, height: 1180 },
  { label: 'Desktop', width: 1280, height: 900 },
] as const;

export function ProfileTemplatePreviewDialog({
  templateName,
  data,
  missingPhotos,
  onClose,
  onUseTemplate,
  onAddPhotos,
}: {
  templateName: string;
  data: ProfilePreviewData | null;
  missingPhotos: boolean;
  onClose: () => void;
  onUseTemplate: () => void;
  onAddPhotos: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const previewArea = useRef<HTMLDivElement>(null);
  const deviceButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const [deviceIndex, setDeviceIndex] = useState(0);
  const [availableWidth, setAvailableWidth] = useState(0);
  const device = DEVICES[deviceIndex] ?? DEVICES[0];
  const scale = Math.min(1, availableWidth > 0 ? availableWidth / device.width : 1);
  const frameHeight = device.height;
  const close = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeButton.current?.focus();
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialog.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [close]);

  useEffect(() => {
    const element = previewArea.current;
    if (!element) return;
    if (typeof ResizeObserver === 'undefined') {
      const updateWidth = () => setAvailableWidth(element.clientWidth);
      updateWidth();
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setAvailableWidth(entry.contentRect.width);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  function selectDeviceByKeyboard(index: number, event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp', 'Home', 'End'].includes(event.key))
      return;
    event.preventDefault();
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? DEVICES.length - 1
          : (index +
              (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) +
              DEVICES.length) %
            DEVICES.length;
    setDeviceIndex(nextIndex);
    deviceButtons.current[nextIndex]?.focus();
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-stretch justify-center bg-slate-950/70 p-0 md:items-center md:p-6">
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="template-preview-title"
        className="flex h-[100dvh] w-full flex-col overflow-hidden bg-white md:h-[min(90dvh,60rem)] md:max-w-7xl md:rounded-2xl md:shadow-2xl"
      >
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-6">
          <div className="min-w-0">
            <h2 id="template-preview-title" className="truncate text-base font-semibold">
              Preview {templateName}
            </h2>
            <p className="text-xs text-slate-500">Using your current draft</p>
          </div>
          <button
            ref={closeButton}
            type="button"
            onClick={close}
            aria-label="Close template preview"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-full border border-slate-300 text-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div
          role="radiogroup"
          aria-label="Preview device size"
          className="flex shrink-0 justify-center gap-2 border-b border-slate-200 px-3 py-2"
        >
          {DEVICES.map((option, index) => (
            <button
              key={option.label}
              ref={(element) => {
                deviceButtons.current[index] = element;
              }}
              type="button"
              role="radio"
              aria-checked={deviceIndex === index}
              tabIndex={deviceIndex === index ? 0 : -1}
              onClick={() => setDeviceIndex(index)}
              onKeyDown={(event) => selectDeviceByKeyboard(index, event)}
              className={`min-h-11 rounded-full border px-4 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 ${
                deviceIndex === index
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-300 bg-white text-slate-700'
              }`}
            >
              {option.label} ({option.width})
            </button>
          ))}
        </div>

        <div
          ref={previewArea}
          className="flex min-h-0 flex-1 items-start justify-center overflow-auto bg-slate-100 p-3 sm:p-5"
        >
          <div
            className="shrink-0 overflow-hidden rounded-xl bg-white shadow-lg"
            style={{
              width: device.width * scale,
              height: frameHeight * scale,
            }}
          >
            <ProfilePreviewFrame
              data={data}
              title={`${templateName} profile preview at ${device.width}px`}
              viewportWidth={device.width}
              viewportHeight={frameHeight}
              tabIndex={-1}
              frameStyle={{
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            />
          </div>
        </div>

        {missingPhotos && (
          <p className="shrink-0 border-t border-slate-200 px-4 py-2 text-center text-sm text-slate-600">
            Add a photo to see it at its best.{' '}
            <a
              href="#profile-images"
              onClick={(event) => {
                event.preventDefault();
                onAddPhotos();
              }}
              className="inline-flex min-h-11 items-center font-semibold text-indigo-700 underline"
            >
              Add photos
            </a>
          </p>
        )}

        <footer className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 bg-white px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3 sm:px-6">
          <button
            type="button"
            onClick={close}
            className="min-h-11 rounded-lg border border-slate-300 px-4 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Close
          </button>
          <button
            type="button"
            onClick={onUseTemplate}
            className="min-h-11 rounded-lg bg-slate-900 px-4 font-semibold text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            Use this template
          </button>
        </footer>
      </section>
    </div>
  );
}
