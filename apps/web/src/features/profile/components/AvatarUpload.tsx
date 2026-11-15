'use client';

import { ImageUpload } from './ImageUpload';

export function AvatarUpload({
  currentUrl,
  onUploaded,
  onDeleted,
}: {
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onDeleted: () => void;
}) {
  return (
    <div>
      <ImageUpload
        kind="AVATAR"
        currentUrl={currentUrl}
        onUploaded={onUploaded}
        onDeleted={onDeleted}
      />
      <p className="mt-1 text-xs text-slate-500">
        JPEG, PNG, or WebP. Avatar images are center-cropped.
      </p>
    </div>
  );
}
