'use client';

import { useEffect, useState } from 'react';

interface ToastMessage {
  id: number;
  message: string;
  tone: 'success' | 'error';
  retry?: () => void;
}

declare global {
  interface WindowEventMap {
    'app-toast': CustomEvent<{
      message: string;
      tone: 'success' | 'error';
      retry?: () => void;
    }>;
  }
}

export function ToastViewport() {
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => {
    const show = (event: WindowEventMap['app-toast']) => {
      setToast({ ...event.detail, id: Date.now() });
    };
    window.addEventListener('app-toast', show);
    return () => window.removeEventListener('app-toast', show);
  }, []);

  if (!toast) return null;
  return (
    <div
      role={toast.tone === 'error' ? 'alert' : 'status'}
      className={`fixed bottom-4 left-4 right-4 z-[60] flex max-w-[calc(100vw-2rem)] items-center gap-4 rounded-xl px-4 py-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] text-sm font-medium shadow-lg sm:left-auto sm:right-4 sm:max-w-sm ${
        toast.tone === 'success' ? 'bg-emerald-700 text-white' : 'bg-rose-700 text-white'
      }`}
    >
      <span>{toast.message}</span>
      {toast.retry && (
        <button
          type="button"
          onClick={() => {
            const retry = toast.retry;
            setToast(null);
            if (retry) retry();
          }}
          className="min-h-11 shrink-0 rounded-lg border border-white/50 px-3 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
        >
          Retry
        </button>
      )}
      <button
        type="button"
        aria-label="Dismiss notification"
        onClick={() => setToast(null)}
        className="min-h-11 min-w-11 rounded-lg text-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        ×
      </button>
    </div>
  );
}
