'use client';

import { ProfilePreviewDataSchema } from '@nfc/shared';
import React, { useEffect, useRef, useState } from 'react';
import type { ProfilePreviewData } from '@nfc/shared';
import type { CSSProperties } from 'react';
import { parseProfilePreviewMessage } from './profile-preview-message';

export function ProfilePreviewFrame({
  data,
  title = 'Live public profile preview',
  viewportWidth,
  viewportHeight,
  frameStyle,
  tabIndex,
}: {
  data: ProfilePreviewData | null;
  title?: string;
  viewportWidth?: number;
  viewportHeight?: number;
  frameStyle?: CSSProperties;
  tabIndex?: number;
}) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>) => {
      const message = parseProfilePreviewMessage(
        event,
        window.location.origin,
        frame.current?.contentWindow,
      );
      if (message?.type === 'profile-preview-ready') setReady(true);
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timeout = window.setTimeout(() => {
      const target = frame.current?.contentWindow;
      if (!target) return;
      const parsed = data ? ProfilePreviewDataSchema.safeParse(data) : null;
      target.postMessage(
        parsed?.success
          ? { type: 'profile-preview-data', payload: parsed.data }
          : { type: 'profile-preview-clear' },
        window.location.origin,
      );
    }, 150);
    return () => window.clearTimeout(timeout);
  }, [data, ready]);

  return (
    <iframe
      ref={frame}
      src="/preview/profile"
      title={title}
      referrerPolicy="no-referrer"
      tabIndex={tabIndex}
      className="block w-full border-0 bg-white"
      style={{
        minHeight: viewportHeight ? undefined : 'min(70vh, 48rem)',
        ...(viewportWidth ? { width: viewportWidth } : {}),
        ...(viewportHeight ? { height: viewportHeight } : {}),
        ...frameStyle,
      }}
    />
  );
}
