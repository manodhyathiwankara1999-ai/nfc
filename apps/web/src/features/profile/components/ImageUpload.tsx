'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { PROFILE_IMAGE_LIMITS } from '@nfc/shared';
import { deleteCurrentAsset, uploadImage, type UploadKind } from '@/lib/api/uploads';

interface ImageUploadProps {
  kind: Extract<UploadKind, 'AVATAR' | 'COVER' | 'GALLERY'>;
  currentUrl?: string | null;
  disabled?: boolean;
  onUploaded?: (url: string, assetId: string) => void;
  onDeleted?: () => void;
}

export function ImageUpload({
  kind,
  currentUrl,
  disabled = false,
  onUploaded,
  onDeleted,
}: ImageUploadProps) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = '';
    if (!selected) return;
    setError('');
    try {
      if (selected.size > PROFILE_IMAGE_LIMITS[kind]) {
        throw new Error(
          `Choose an image smaller than ${PROFILE_IMAGE_LIMITS[kind] / (1024 * 1024)} MB.`,
        );
      }
      const image = await prepareImage(selected, kind);
      setProgress(0);
      const result = await uploadImage(image, kind, setProgress);
      onUploaded?.(result.url, result.assetId);
      setProgress(null);
    } catch (cause) {
      setProgress(null);
      setError(cause instanceof Error ? cause.message : 'Could not upload this image.');
    }
  }

  async function remove() {
    setDeleting(true);
    setError('');
    try {
      await deleteCurrentAsset(kind);
      onDeleted?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete this image.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-2">
      {currentUrl && kind !== 'GALLERY' && (
        <Image
          src={currentUrl}
          alt={kind === 'AVATAR' ? 'Current avatar' : 'Current cover image'}
          width={kind === 'AVATAR' ? 80 : 320}
          height={kind === 'AVATAR' ? 80 : 160}
          className={
            kind === 'AVATAR'
              ? 'h-20 w-20 rounded-full object-cover'
              : 'h-24 w-full rounded-xl object-cover'
          }
          unoptimized
        />
      )}
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        aria-label={`Choose ${kind.toLowerCase()} image`}
        onChange={handleChange}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={disabled || progress !== null || deleting}
          className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium disabled:opacity-50"
        >
          {progress !== null
            ? `Uploading ${progress}%`
            : currentUrl
              ? 'Replace image'
              : `Upload ${kind.toLowerCase()}`}
        </button>
        {currentUrl && kind !== 'GALLERY' && (
          <button
            type="button"
            onClick={remove}
            disabled={deleting || progress !== null}
            className="rounded-lg border border-rose-200 px-3 py-2 text-sm text-rose-700 disabled:opacity-50"
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        )}
      </div>
      {progress !== null && (
        <progress className="h-2 w-full accent-indigo-600" value={progress} max={100} />
      )}
      {error && (
        <p role="alert" className="text-sm text-rose-700">
          {error}
        </p>
      )}
    </div>
  );
}

async function prepareImage(
  file: File,
  kind: Extract<UploadKind, 'AVATAR' | 'COVER' | 'GALLERY'>,
): Promise<File> {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
    throw new Error('Choose a JPEG, PNG, or WebP image.');
  }
  if (file.size > PROFILE_IMAGE_LIMITS[kind]) {
    throw new Error(
      `Choose an image smaller than ${PROFILE_IMAGE_LIMITS[kind] / (1024 * 1024)} MB.`,
    );
  }
  const source = await createImageBitmap(file);
  const cropRatio = kind === 'AVATAR' ? 1 : kind === 'COVER' ? 2 : null;
  const cropWidth = cropRatio ? Math.min(source.width, source.height * cropRatio) : source.width;
  const cropHeight = cropRatio ? cropWidth / cropRatio : source.height;
  const outputWidth = cropRatio ? (kind === 'COVER' ? 1600 : 1000) : Math.min(source.width, 2000);
  const outputHeight = cropRatio
    ? outputWidth / cropRatio
    : Math.round((source.height / source.width) * outputWidth);
  const canvas = document.createElement('canvas');
  canvas.width = outputWidth;
  canvas.height = outputHeight;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image processing is not available in this browser.');
  if (cropRatio) {
    const startX = (source.width - cropWidth) / 2;
    const startY = (source.height - cropHeight) / 2;
    context.drawImage(
      source,
      startX,
      startY,
      cropWidth,
      cropHeight,
      0,
      0,
      outputWidth,
      outputHeight,
    );
  } else {
    context.drawImage(source, 0, 0, outputWidth, outputHeight);
  }
  source.close();
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error('Image compression failed.'))),
      'image/webp',
      0.82,
    );
  });
  return new File([blob], `${kindName(file.name)}.webp`, { type: 'image/webp' });
}

function kindName(name: string) {
  return (
    name
      .replace(/\.[^.]+$/, '')
      .replace(/[^a-zA-Z0-9_-]/g, '')
      .slice(0, 48) || 'image'
  );
}
