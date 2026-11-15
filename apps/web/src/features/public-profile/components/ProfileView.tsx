'use client';

import QRCode from 'qrcode';
import React, { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { profileThemeCssVariables, type CardOffice, type CardProductResponse } from '@nfc/shared';
import type { PublicProfile } from '@/features/profile/types/profile';
import { createProfileCsv, createProfileVCard } from '../profile-downloads';
import { createProfileTemplateViewModel } from '../templates/view-model';
import { DefaultTemplateComponent, resolveTemplateComponent } from '../templates/registry';
import styles from './ProfileView.module.css';

interface ProfileViewProps {
  profile: PublicProfile;
  office?: CardOffice | null;
  products?: CardProductResponse[];
  showProducts?: boolean;
  preview?: boolean;
}

export function ProfileView({
  profile,
  office = null,
  products = [],
  showProducts = false,
}: ProfileViewProps) {
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [qrError, setQrError] = useState('');
  const viewModel = useMemo(
    () => createProfileTemplateViewModel(profile, office, products, showProducts),
    [office, products, profile, showProducts],
  );
  const themeStyle = profileThemeCssVariables(viewModel.palette) as CSSProperties;
  const publicUrl =
    typeof window === 'undefined'
      ? `/u/${encodeURIComponent(profile.slug)}`
      : `${window.location.origin}/u/${encodeURIComponent(profile.slug)}`;
  const vcard = useMemo(() => createProfileVCard(profile, publicUrl), [profile, publicUrl]);

  useEffect(() => {
    let active = true;
    setQrError('');
    void QRCode.toDataURL(vcard, { width: 240, margin: 2, errorCorrectionLevel: 'M' })
      .then((value) => {
        if (active) setQrDataUrl(value);
      })
      .catch(() => {
        if (active) setQrError('The contact QR code could not be created.');
      });
    return () => {
      active = false;
    };
  }, [vcard]);

  const actions = useMemo(
    () => ({
      downloadContact: () => downloadFile(vcard, 'text/vcard', 'vcf', profile.fullName),
      downloadCsv: () =>
        downloadFile(createProfileCsv(profile, publicUrl), 'text/csv', 'csv', profile.fullName),
      qrDataUrl,
      qrError,
    }),
    [profile, publicUrl, qrDataUrl, qrError, vcard],
  );
  const { id: selectedTemplateId, component: Template } = resolveTemplateComponent(
    profile.templateId,
  );

  return (
    <div className={styles.themeRoot} style={themeStyle}>
      <TemplateErrorBoundary
        key={`${profile.slug}:${selectedTemplateId ?? 'default'}`}
        fallback={
          selectedTemplateId === null ? (
            <p role="alert" className="p-8 text-center">
              This profile is temporarily unavailable.
            </p>
          ) : (
            <DefaultTemplateComponent viewModel={viewModel} actions={actions} />
          )
        }
      >
        <Template viewModel={viewModel} actions={actions} />
      </TemplateErrorBoundary>
    </div>
  );
}

class TemplateErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    console.error('Public profile template failed; using its safe fallback.', error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function downloadFile(content: string, mime: string, extension: string, name: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = `${downloadFileName(name)}.${extension}`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadFileName(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80) || 'contact'
  );
}
