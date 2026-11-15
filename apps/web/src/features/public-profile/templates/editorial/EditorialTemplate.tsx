'use client';

import Image from 'next/image';
import React from 'react';
import { useEffect, useRef, useState } from 'react';
import { isOptimizablePublicImage } from '../../../../lib/images/public-image';
import type { PublicProfileTemplateProps } from '../contract';
import styles from './EditorialTemplate.module.css';

export default function EditorialTemplate({ viewModel, actions }: PublicProfileTemplateProps) {
  const { profile, office, products, sections, socialLinks } = viewModel;
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const galleryTrigger = useRef<HTMLButtonElement | null>(null);
  const galleryClose = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (galleryIndex === null) {
      galleryTrigger.current?.focus();
      return;
    }
    galleryClose.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGalleryIndex(null);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [galleryIndex]);

  return (
    <main className={styles.root}>
      <article className={styles.content}>
        <header className={styles.header}>
          <p className="mb-5 font-sans text-xs font-bold uppercase tracking-[0.2em] text-[var(--theme-primary)]">
            Portfolio
          </p>
          {profile.coverImage && (
            <Image
              src={profile.coverImage}
              alt=""
              width={1280}
              height={420}
              priority
              unoptimized={!isOptimizablePublicImage(profile.coverImage)}
              className={`${styles.image} mb-8 aspect-[3/1] w-full object-cover`}
            />
          )}
          <h1 className={styles.name}>{profile.fullName}</h1>
          {profile.jobTitle && <p className="mt-4 text-xl">{profile.jobTitle}</p>}
          {profile.skillsLine && (
            <p className="mt-2 font-sans text-sm text-slate-600">{profile.skillsLine}</p>
          )}
          {profile.tagline && <p className="mt-6 max-w-2xl text-lg leading-8">{profile.tagline}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={actions.downloadContact}>
              Download contact
            </button>
            {socialLinks.map((item) => (
              <a
                key={item.platform}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.action}
              >
                {formatPlatform(item.platform)}
              </a>
            ))}
          </div>
          {profile.avatar ? (
            <Image
              src={profile.avatar}
              alt={`${profile.fullName}'s profile photo`}
              width={144}
              height={144}
              priority
              unoptimized={!isOptimizablePublicImage(profile.avatar)}
              className="mt-8 h-36 w-36 rounded-full object-cover"
            />
          ) : (
            <span
              aria-hidden="true"
              className="mt-8 flex h-36 w-36 items-center justify-center rounded-full bg-[var(--theme-soft)] font-sans text-4xl font-semibold text-[var(--theme-primary)]"
            >
              {profile.fullName.charAt(0).toUpperCase()}
            </span>
          )}
        </header>

        <div className={styles.contactQrGrid}>
          {sections.contact && (
            <section className={styles.section} aria-labelledby="editorial-contact">
              <h2 id="editorial-contact">Contact</h2>
              <div className="mt-4 grid gap-3 font-sans sm:grid-cols-2">
                {profile.phone && (
                  <a className={styles.contactLink} href={`tel:${profile.phone}`}>
                    {profile.phone}
                  </a>
                )}
                {profile.email && (
                  <a className={styles.contactLink} href={`mailto:${profile.email}`}>
                    {profile.email}
                  </a>
                )}
                {profile.location && (
                  <p className="flex min-h-11 items-center break-words">{profile.location}</p>
                )}
                {profile.website && (
                  <a
                    className={styles.contactLink}
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {profile.website}
                  </a>
                )}
              </div>
            </section>
          )}

          <section className={styles.section} aria-labelledby="editorial-qr">
            <h2 id="editorial-qr">Save contact</h2>
            {actions.qrDataUrl ? (
              <Image
                src={actions.qrDataUrl}
                alt={`QR code for ${profile.fullName}'s contact`}
                width={160}
                height={160}
                unoptimized
                className="mt-4"
              />
            ) : actions.qrError ? (
              <p role="alert" className="mt-4 font-sans text-sm text-rose-700">
                {actions.qrError}
              </p>
            ) : (
              <p role="status" className="mt-4 font-sans text-sm text-slate-600">
                Preparing QR code…
              </p>
            )}
          </section>
        </div>

        {office && (
          <section className={styles.section} aria-labelledby="editorial-office">
            <h2 id="editorial-office">Office</h2>
            {office.companyName && <p className="mt-4 break-words text-xl">{office.companyName}</p>}
            {office.designation && (
              <p className="mt-2 break-words font-sans text-sm">{office.designation}</p>
            )}
            {office.department && (
              <p className="mt-1 break-words font-sans text-sm">{office.department}</p>
            )}
            {office.officeAddress && (
              <p className="mt-4 whitespace-pre-line break-words font-sans text-sm">
                {office.officeAddress}
              </p>
            )}
            {office.workingHours && (
              <p className="mt-2 break-words font-sans text-sm">{office.workingHours}</p>
            )}
            {office.officePhone && (
              <a className={styles.contactLink} href={`tel:${office.officePhone}`}>
                {office.officePhone}
              </a>
            )}
            {office.officeEmail && (
              <a className={styles.contactLink} href={`mailto:${office.officeEmail}`}>
                {office.officeEmail}
              </a>
            )}
            {office.companyWebsite && (
              <a
                className={styles.contactLink}
                href={office.companyWebsite}
                target="_blank"
                rel="noopener noreferrer"
              >
                Company website
              </a>
            )}
          </section>
        )}

        {sections.products && (
          <section className={styles.section} aria-labelledby="editorial-products">
            <h2 id="editorial-products">Products &amp; Services</h2>
            <ul className="mt-5 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <li key={product.id} className="font-sans">
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={640}
                    height={480}
                    loading="lazy"
                    unoptimized={!isOptimizablePublicImage(product.image)}
                    className={`${styles.image} aspect-[4/3] w-full object-cover`}
                  />
                  <h3 className="mt-3 break-words text-lg font-semibold">{product.name}</h3>
                  {product.price !== null && product.price !== undefined && (
                    <p className="mt-1 text-sm font-semibold text-[var(--theme-primary)]">
                      {product.currency} {product.price}
                    </p>
                  )}
                  {product.detail && (
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      {product.detail}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={styles.section} aria-labelledby="editorial-links">
          <h2 id="editorial-links">Quick links</h2>
          <div className={styles.actions}>
            {profile.phone && (
              <a className={styles.action} href={`tel:${profile.phone}`}>
                Call
              </a>
            )}
            {profile.email && (
              <a className={styles.action} href={`mailto:${profile.email}`}>
                Email
              </a>
            )}
            {profile.website && (
              <a
                className={styles.action}
                href={profile.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Website
              </a>
            )}
            {socialLinks.map((item) => (
              <a
                key={`quick-${item.platform}`}
                className={styles.action}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatPlatform(item.platform)}
              </a>
            ))}
            <button type="button" className={styles.action} onClick={actions.downloadCsv}>
              Download CSV
            </button>
          </div>
        </section>

        {sections.gallery && (
          <section className={styles.section} aria-labelledby="editorial-gallery">
            <h2 id="editorial-gallery">Gallery</h2>
            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
              {profile.galleryImages.map((image, index) => (
                <button
                  key={`${image.url}-${index}`}
                  type="button"
                  className={styles.galleryItem}
                  aria-label={`View image ${index + 1}${image.alt ? `: ${image.alt}` : ''}`}
                  onClick={(event) => {
                    galleryTrigger.current = event.currentTarget;
                    setGalleryIndex(index);
                  }}
                >
                  <Image
                    src={image.url}
                    alt={image.alt}
                    width={640}
                    height={640}
                    loading="lazy"
                    unoptimized={!isOptimizablePublicImage(image.url)}
                    className={`${styles.image} aspect-square w-full object-cover`}
                  />
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className="pt-8 font-sans text-xs text-slate-500">
          © {new Date().getFullYear()} {profile.fullName}
        </footer>
      </article>

      {galleryIndex !== null && profile.galleryImages[galleryIndex] && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Gallery image viewer"
          tabIndex={-1}
          onClick={(event) => {
            if (event.target === event.currentTarget) setGalleryIndex(null);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Tab') {
              event.preventDefault();
              galleryClose.current?.focus();
            }
            if (event.key === 'ArrowRight') {
              setGalleryIndex((index) =>
                index === null ? null : (index + 1) % profile.galleryImages.length,
              );
            }
            if (event.key === 'ArrowLeft') {
              setGalleryIndex((index) =>
                index === null
                  ? null
                  : (index - 1 + profile.galleryImages.length) % profile.galleryImages.length,
              );
            }
          }}
        >
          <button
            ref={galleryClose}
            type="button"
            aria-label="Close image viewer"
            className="absolute right-4 top-4 min-h-11 rounded-full bg-white px-4"
            onClick={() => setGalleryIndex(null)}
          >
            Close image
          </button>
          <Image
            src={profile.galleryImages[galleryIndex].url}
            alt={profile.galleryImages[galleryIndex].alt}
            width={1200}
            height={900}
            unoptimized={!isOptimizablePublicImage(profile.galleryImages[galleryIndex].url)}
            className="max-h-[80vh] w-auto object-contain"
          />
        </div>
      )}
    </main>
  );
}

function formatPlatform(platform: string): string {
  return platform === 'X' ? 'X' : `${platform.charAt(0)}${platform.slice(1).toLowerCase()}`;
}
