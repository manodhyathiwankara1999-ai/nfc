'use client';

import React, { useEffect, useState } from 'react';
import type { ProfilePreviewData } from '@nfc/shared';
import { ProfileView } from '@/features/public-profile/components/ProfileView';
import { parseProfilePreviewMessage } from '@/features/profile/components/profile-preview-message';

export function ProfilePreviewReceiver() {
  const [preview, setPreview] = useState<ProfilePreviewData | null>(null);

  useEffect(() => {
    let receivedDraft = false;
    let readyInterval: number | undefined;
    const sendReady = () => {
      if (receivedDraft) return;
      window.parent.postMessage({ type: 'profile-preview-ready' }, window.location.origin);
    };
    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = parseProfilePreviewMessage(event, window.location.origin, window.parent);
      if (!message) return;
      if (message.type === 'profile-preview-data') {
        receivedDraft = true;
        if (readyInterval !== undefined) window.clearInterval(readyInterval);
        setPreview(message.payload);
      }
      if (message.type === 'profile-preview-clear') {
        receivedDraft = true;
        if (readyInterval !== undefined) window.clearInterval(readyInterval);
        setPreview(null);
      }
    };
    window.addEventListener('message', handleMessage);
    sendReady();
    readyInterval = window.setInterval(sendReady, 200);
    return () => {
      window.clearInterval(readyInterval);
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  if (!preview) {
    return (
      <main
        aria-label="Loading profile preview"
        className="min-h-screen animate-pulse bg-slate-50 p-5 motion-reduce:animate-none"
      >
        <div className="mx-auto max-w-4xl space-y-5">
          <div className="h-40 rounded-2xl bg-slate-200" />
          <div className="h-24 w-2/3 rounded-xl bg-slate-200" />
          <div className="h-56 rounded-2xl bg-white" />
        </div>
      </main>
    );
  }

  return (
    <ProfileView
      profile={preview.profile}
      office={preview.office}
      products={preview.products}
      showProducts={preview.showProducts}
    />
  );
}
