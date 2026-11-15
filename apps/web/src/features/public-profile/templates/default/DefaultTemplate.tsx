'use client';

import Image from 'next/image';
import React from 'react';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { PublicProfile } from '@/features/profile/types/profile';
import { isOptimizablePublicImage } from '../../../../lib/images/public-image';
import { CardPublicDetails } from '../../components/CardPublicDetails';
import type { PublicProfileTemplateProps } from '../contract';
import styles from './DefaultTemplate.module.css';

type SectionId = 'profile' | 'contact' | 'gallery' | 'downloads';
type IconName = 'phone' | 'email' | 'location' | 'website' | 'download' | 'link' | 'menu' | 'close';

const navigation: Array<{ id: SectionId; label: string }> = [
  { id: 'profile', label: 'Profile' },
  { id: 'contact', label: 'Contact' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'downloads', label: 'Download CSV' },
];

export default function DefaultTemplate({ viewModel, actions }: PublicProfileTemplateProps) {
  const { profile, sections, office, products } = viewModel;
  const { downloadContact, downloadCsv, qrDataUrl, qrError } = actions;
  const [activeSection, setActiveSection] = useState<SectionId>('profile');
  const [menuOpen, setMenuOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [dotsPaused, setDotsPaused] = useState(false);
  const [motionReady, setMotionReady] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const lightboxTrigger = useRef<HTMLButtonElement | null>(null);
  const socialLinks = viewModel.socialLinks;
  const visibleNavigation = navigation.filter(
    (item) =>
      (item.id !== 'contact' || sections.contact) && (item.id !== 'gallery' || sections.gallery),
  );

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const hardwareIsLimited =
      (navigator.hardwareConcurrency ?? 8) <= 4 ||
      ('deviceMemory' in navigator && Number(navigator.deviceMemory) <= 4);
    const syncAnimationState = () => {
      setDotsPaused(document.hidden || hardwareIsLimited || reducedMotion.matches);
    };

    syncAnimationState();
    document.addEventListener('visibilitychange', syncAnimationState);
    reducedMotion.addEventListener('change', syncAnimationState);
    return () => {
      document.removeEventListener('visibilitychange', syncAnimationState);
      reducedMotion.removeEventListener('change', syncAnimationState);
    };
  }, []);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
    setMotionReady(true);
    const revealSections =
      container.current?.querySelectorAll<HTMLElement>(`.${styles.reveal}`) ?? [];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -24px 0px' },
    );
    revealSections.forEach((section, index) => {
      section.style.setProperty('--reveal-order', String(Math.min(index, 6)));
      observer.observe(section);
    });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const observedSections = visibleNavigation
      .map(({ id }) => container.current?.querySelector<HTMLElement>(`#${id}`) ?? null)
      .filter((section): section is HTMLElement => section !== null);
    if (!('IntersectionObserver' in window) || observedSections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (visible) setActiveSection(visible.target.id as SectionId);
      },
      { rootMargin: '-15% 0px -70% 0px', threshold: [0, 0.25, 0.5] },
    );
    observedSections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [visibleNavigation]);

  useEffect(() => {
    if (lightboxIndex === null) return;
    closeButton.current?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setLightboxIndex(null);
      if (event.key === 'ArrowRight') {
        setLightboxIndex((index) =>
          index === null ? null : (index + 1) % profile.galleryImages.length,
        );
      }
      if (event.key === 'ArrowLeft') {
        setLightboxIndex((index) =>
          index === null
            ? null
            : (index - 1 + profile.galleryImages.length) % profile.galleryImages.length,
        );
      }
      if (event.key === 'Tab') {
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
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [lightboxIndex, profile.galleryImages.length]);

  useEffect(() => {
    if (lightboxIndex !== null) return;
    lightboxTrigger.current?.focus();
  }, [lightboxIndex]);

  return (
    <div data-motion-ready={motionReady} ref={container} className={styles.root}>
      <div
        aria-hidden="true"
        className={`${styles.dotPattern}${dotsPaused ? ` ${styles.paused}` : ''}`}
      />
      <div className="relative z-10">
        <header className="relative z-20 flex min-h-14 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur lg:hidden">
          <a
            href="#profile"
            className="inline-flex min-h-11 items-center font-semibold tracking-tight text-slate-900"
            aria-label="Profile home"
          >
            nfc<span className="text-[var(--theme-primary)]">.</span>card
          </a>
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200"
            aria-expanded={menuOpen}
            aria-controls="mobile-profile-nav"
            aria-label={menuOpen ? 'Close menu' : 'Open menu'}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Icon name={menuOpen ? 'close' : 'menu'} />
          </button>
          {menuOpen && (
            <nav
              id="mobile-profile-nav"
              className="absolute inset-x-0 top-full border-b border-slate-200 bg-white p-3 shadow-lg"
              aria-label="Profile navigation"
            >
              <NavigationLinks
                items={visibleNavigation}
                active={activeSection}
                onNavigate={() => setMenuOpen(false)}
                onDownload={downloadCsv}
              />
            </nav>
          )}
        </header>

        <div className="mx-auto w-full max-w-[1080px]">
          <main className="min-w-0">
            <section id="profile" className={`${styles.reveal} scroll-mt-6`}>
              <div className="relative h-40 overflow-hidden bg-slate-200 sm:h-56 lg:h-72">
                {profile.coverImage && (
                  <Image
                    src={profile.coverImage}
                    alt=""
                    fill
                    priority
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 100vw, 1220px"
                    className="object-cover"
                    unoptimized={!isOptimizablePublicImage(profile.coverImage)}
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-slate-950/15 to-transparent" />
                {profile.tagline && (
                  <div className="absolute inset-x-5 bottom-7 sm:inset-x-8 lg:inset-x-12">
                    <p className="max-w-2xl break-words text-base font-semibold text-white drop-shadow sm:text-xl">
                      {profile.tagline}
                    </p>
                    <span className="mt-2 block h-1 w-12 rounded-full bg-[var(--theme-primary)]" />
                  </div>
                )}
              </div>
              <div className="mx-auto -mt-12 w-full max-w-4xl px-4 sm:-mt-14 sm:px-8 lg:-mt-16">
                <div className="flex min-w-0 flex-col items-start">
                  <Avatar profile={profile} />
                  <div className={`${styles.reveal} mt-4 min-w-0 w-full`}>
                    <h1 className="break-words text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
                      {profile.fullName}
                    </h1>
                    {profile.jobTitle && (
                      <p className="mt-1 break-words text-lg font-medium text-slate-600 sm:text-xl">
                        {profile.jobTitle}
                      </p>
                    )}
                    {profile.skillsLine && (
                      <p className="mt-2 break-words text-sm text-slate-500 sm:text-base">
                        {profile.skillsLine
                          .split(/[,|]/)
                          .map((skill) => skill.trim())
                          .filter(Boolean)
                          .join(' | ')}
                      </p>
                    )}
                    {sections.social && (
                      <div className="mt-4 flex flex-wrap gap-2" aria-label="Social profiles">
                        {socialLinks.map((item) => (
                          <SocialLink key={item.platform} platform={item.platform} url={item.url} />
                        ))}
                        {profile.email && (
                          <SocialLink platform="email" url={`mailto:${profile.email}`} />
                        )}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={downloadContact}
                      className={`${styles.themeShine} mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[var(--theme-button-fill)] px-6 py-3 text-sm font-semibold text-[var(--theme-button-text)] transition-colors hover:bg-[var(--theme-primary-hover)] active:bg-[var(--theme-primary-pressed)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)] sm:w-auto`}
                    >
                      <Icon name="download" />
                      Download Contact
                    </button>
                  </div>
                </div>
              </div>
            </section>

            <div className="mx-auto mt-8 grid min-w-0 max-w-4xl gap-5 px-4 pb-8 sm:px-8 md:grid-cols-2 md:items-start">
              {sections.contact && (
                <section
                  id="contact"
                  className={`${styles.reveal} scroll-mt-6 rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur sm:p-7`}
                >
                  <h2 className="text-lg font-semibold">Contact</h2>
                  <div className="mt-4 grid gap-1 sm:grid-cols-2">
                    {profile.phone && (
                      <ContactRow icon="phone" label="Phone">
                        <a
                          href={`tel:${profile.phone}`}
                          className="inline-flex min-h-11 items-center break-all text-[var(--theme-link)] hover:underline"
                        >
                          {profile.phone}
                        </a>
                      </ContactRow>
                    )}
                    {profile.email && (
                      <ContactRow icon="email" label="Email">
                        <a
                          href={`mailto:${profile.email}`}
                          className="inline-flex min-h-11 items-center break-all text-[var(--theme-link)] hover:underline"
                        >
                          {profile.email}
                        </a>
                      </ContactRow>
                    )}
                    {profile.location && (
                      <ContactRow icon="location" label="Location">
                        <span className="break-words">{profile.location}</span>
                      </ContactRow>
                    )}
                    {profile.website && (
                      <ContactRow icon="website" label="Website">
                        <a
                          href={profile.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center break-all text-[var(--theme-link)] hover:underline"
                        >
                          {displayHost(profile.website)}
                        </a>
                      </ContactRow>
                    )}
                  </div>
                </section>
              )}

              <section
                className={`${styles.reveal} rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur sm:p-7`}
              >
                <h2 className="text-lg font-semibold">QR code</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Scan to save {profile.fullName} to your contacts.
                </p>
                <div className="mt-4 flex min-h-56 items-center justify-center rounded-2xl bg-[var(--theme-soft)] p-4">
                  {qrDataUrl ? (
                    <Image
                      src={qrDataUrl}
                      alt={`QR code for ${profile.fullName}'s contact`}
                      width={208}
                      height={208}
                      unoptimized
                    />
                  ) : qrError ? (
                    <p role="alert" className="text-sm text-rose-700">
                      {qrError}
                    </p>
                  ) : (
                    <p role="status" className="text-sm text-slate-600">
                      Preparing QR code…
                    </p>
                  )}
                </div>
              </section>
            </div>

            <CardPublicDetails
              office={office}
              products={products}
              showProducts={sections.products}
              productCardClassName={styles.productCard}
              sectionClassName={styles.reveal}
            />

            <section
              id="downloads"
              className={`${styles.reveal} mx-auto max-w-4xl scroll-mt-6 px-4 pb-8 sm:px-8`}
            >
              <div className="rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur sm:p-7">
                <h2 className="text-lg font-semibold">Quick Links</h2>
                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  {profile.phone && (
                    <QuickLink href={`tel:${profile.phone}`} icon="phone">
                      Call
                    </QuickLink>
                  )}
                  {profile.email && (
                    <QuickLink href={`mailto:${profile.email}`} icon="email">
                      Email
                    </QuickLink>
                  )}
                  {profile.website && (
                    <QuickLink href={profile.website} external icon="website">
                      Website
                    </QuickLink>
                  )}
                  {socialLinks.map((item) => (
                    <QuickLink key={item.platform} href={item.url} external>
                      {socialLabel(item.platform)}
                    </QuickLink>
                  ))}
                  <button
                    type="button"
                    onClick={downloadCsv}
                    className="min-h-12 rounded-full border border-slate-200 px-4 py-3 text-sm font-semibold transition-colors hover:border-[var(--theme-primary)] hover:bg-[var(--theme-soft)] active:bg-[var(--theme-soft)]"
                  >
                    Download CSV
                  </button>
                </div>
              </div>
            </section>

            {profile.galleryImages.length > 0 && (
              <section
                id="gallery"
                className={`${styles.reveal} mx-auto max-w-4xl scroll-mt-6 px-4 pb-10 sm:px-8`}
              >
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-xl font-semibold">Gallery</h2>
                    <p className="mt-1 text-sm text-slate-500">A few moments from my work.</p>
                  </div>
                  <button
                    type="button"
                    onClick={(event) => {
                      lightboxTrigger.current = event.currentTarget;
                      setLightboxIndex(0);
                    }}
                    className="flex min-h-11 shrink-0 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-[var(--theme-link)] hover:bg-[var(--theme-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-primary)]"
                  >
                    View All <span aria-hidden="true">→</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-3 lg:grid-cols-4">
                  {profile.galleryImages.slice(0, 12).map((image, index) => (
                    <button
                      key={`${image.url}-${index}`}
                      type="button"
                      onClick={(event) => {
                        lightboxTrigger.current = event.currentTarget;
                        setLightboxIndex(index);
                      }}
                      aria-label={`View image ${index + 1}${image.alt ? `: ${image.alt}` : ''}`}
                      className={`${styles.reveal} group relative aspect-square min-w-0 overflow-hidden rounded-xl bg-slate-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--theme-primary)]`}
                    >
                      <Image
                        src={image.url}
                        alt={image.alt}
                        fill
                        sizes="(max-width: 640px) 30vw, (max-width: 1024px) 22vw, 250px"
                        loading="lazy"
                        unoptimized={!isOptimizablePublicImage(image.url)}
                        className="object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <footer className="border-t border-slate-200 bg-white/80 px-4 py-6 text-center text-sm text-slate-600 backdrop-blur">
              © {new Date().getFullYear()} {profile.fullName}
            </footer>
          </main>
        </div>

        {lightboxIndex !== null && profile.galleryImages[lightboxIndex] && (
          <div
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="Gallery image viewer"
            className={`${styles.lightboxOverlay} fixed inset-0 z-50 flex items-center justify-center bg-slate-950/95 p-4`}
            onClick={(event) => {
              if (event.target === event.currentTarget) setLightboxIndex(null);
            }}
          >
            <button
              ref={closeButton}
              type="button"
              onClick={() => setLightboxIndex(null)}
              aria-label="Close image viewer"
              className="absolute right-4 top-4 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white text-slate-900"
            >
              <Icon name="close" />
            </button>
            <button
              type="button"
              onClick={() =>
                setLightboxIndex(
                  (lightboxIndex - 1 + profile.galleryImages.length) % profile.galleryImages.length,
                )
              }
              aria-label="Previous image"
              className="absolute left-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-slate-900 sm:left-6"
            >
              ‹
            </button>
            <figure className="flex max-h-full max-w-full flex-col items-center">
              <div className="relative h-[70vh] max-h-[800px] w-[90vw] max-w-[1100px]">
                <Image
                  src={profile.galleryImages[lightboxIndex].url}
                  alt={profile.galleryImages[lightboxIndex].alt}
                  fill
                  sizes="90vw"
                  unoptimized={!isOptimizablePublicImage(profile.galleryImages[lightboxIndex].url)}
                  className="object-contain"
                />
              </div>
              {profile.galleryImages[lightboxIndex].caption && (
                <figcaption className="mt-3 text-center text-sm text-white">
                  {profile.galleryImages[lightboxIndex].caption}
                </figcaption>
              )}
            </figure>
            <button
              type="button"
              onClick={() => setLightboxIndex((lightboxIndex + 1) % profile.galleryImages.length)}
              aria-label="Next image"
              className="absolute right-2 flex min-h-11 min-w-11 items-center justify-center rounded-full bg-white/90 text-2xl text-slate-900 sm:right-6"
            >
              ›
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function NavigationLinks({
  items,
  active,
  onNavigate,
  onDownload,
}: {
  items: Array<{ id: SectionId; label: string }>;
  active: SectionId;
  onNavigate: () => void;
  onDownload: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => (
        <li key={item.id}>
          {item.id === 'downloads' ? (
            <button
              type="button"
              aria-current={active === 'downloads' ? 'location' : undefined}
              onClick={() => {
                onDownload();
                onNavigate();
              }}
              className={`flex min-h-11 w-full items-center rounded-lg px-4 text-left text-sm font-medium ${
                active === 'downloads'
                  ? 'bg-[var(--theme-soft)] text-[var(--theme-primary)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ) : (
            <a
              href={`#${item.id}`}
              onClick={onNavigate}
              aria-current={active === item.id ? 'location' : undefined}
              className={`flex min-h-11 items-center rounded-lg px-4 text-sm font-medium ${
                active === item.id
                  ? 'bg-[var(--theme-soft)] text-[var(--theme-primary)]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
              }`}
            >
              {item.label}
            </a>
          )}
        </li>
      ))}
    </ul>
  );
}

function Avatar({ profile }: { profile: PublicProfile }) {
  return (
    <div
      className={`${styles.avatarRing} relative flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-white p-[3px] shadow-md sm:h-28 sm:w-28 lg:h-32 lg:w-32`}
    >
      <div className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-white">
        {profile.avatar ? (
          <Image
            src={profile.avatar}
            alt={`${profile.fullName}'s profile photo`}
            fill
            sizes="(max-width: 640px) 96px, 128px"
            priority
            unoptimized={!isOptimizablePublicImage(profile.avatar)}
            className="object-cover"
          />
        ) : (
          <span className="text-3xl font-bold text-[var(--theme-primary)]" aria-hidden="true">
            {profile.fullName.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

function SocialLink({ platform, url }: { platform: string; url: string }) {
  const label = socialLabel(platform);
  const external = !url.startsWith('mailto:');
  return (
    <a
      href={url}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      aria-label={external ? `Open ${label} profile` : 'Email'}
      className="flex min-h-11 min-w-11 items-center justify-center rounded-full border border-white/80 bg-white/80 px-3 text-xs font-bold text-[var(--theme-icon)] shadow-sm transition-transform hover:-translate-y-0.5 hover:bg-[var(--theme-soft)] active:translate-y-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-primary)]"
    >
      {platform === 'email' ? (
        <Icon name="email" />
      ) : platform === 'LINKEDIN' ? (
        'in'
      ) : platform === 'GITHUB' ? (
        'GH'
      ) : (
        label.slice(0, 3).toUpperCase()
      )}
    </a>
  );
}

function socialLabel(platform: string): string {
  const labels: Record<string, string> = {
    email: 'Email',
    WEBSITE: 'Website',
    LINKEDIN: 'LinkedIn',
    GITHUB: 'GitHub',
    INSTAGRAM: 'Instagram',
    FACEBOOK: 'Facebook',
    X: 'X',
    YOUTUBE: 'YouTube',
    TIKTOK: 'TikTok',
  };
  return labels[platform] ?? 'Social';
}

function ContactRow({
  icon,
  label,
  children,
}: {
  icon: IconName;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-start gap-3 rounded-lg px-2 py-3">
      <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--theme-soft)] text-[var(--theme-icon)]">
        <Icon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  );
}

function QuickLink({
  href,
  external = false,
  icon = 'link',
  children,
}: {
  href: string;
  external?: boolean;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex min-h-12 items-center justify-between gap-3 rounded-xl border border-slate-200 px-4 py-3 text-sm font-medium hover:border-[var(--theme-primary)] hover:bg-[var(--theme-soft)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--theme-primary)]"
    >
      <span className="flex items-center gap-3">
        <span className="text-[var(--theme-icon)]">
          <Icon name={icon} />
        </span>
        {children}
      </span>
      {external && (
        <span aria-hidden="true" className="text-slate-400">
          ↗
        </span>
      )}
    </a>
  );
}

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string> = {
    phone:
      'M22 16.92v3a2 2 0 0 1-2.18 2 19.8 19.8 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.12 4.2 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.12.96.36 1.9.7 2.8a2 2 0 0 1-.45 2.11L8.1 9.9a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.84.58 2.8.7a2 2 0 0 1 1.72 2.04Z',
    email: 'M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm18 2-10 7L2 6',
    location: 'M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Zm-5 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
    website:
      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Zm0 0c2.5-2.7 4-6.1 4-10S14.5 4.7 12 2c-2.5 2.7-4 6.1-4 10s1.5 7.3 4 10ZM2 12h20',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3',
    link: 'M10 13a5 5 0 0 0 7.07 0l3-3A5 5 0 0 0 13 2.93l-1.72 1.71m2.72 6.36a5 5 0 0 0-7.07 0l-3 3A5 5 0 0 0 11 21.07l1.71-1.71',
    menu: 'M4 6h16M4 12h16M4 18h16',
    close: 'M18 6 6 18M6 6l12 12',
  };
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  );
}

function displayHost(value: string): string {
  try {
    return new URL(value).hostname.replace(/^www\./, '');
  } catch {
    return value;
  }
}
