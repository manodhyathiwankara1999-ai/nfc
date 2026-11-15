'use client';

import Image from 'next/image';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { isOptimizablePublicImage } from '../../../../lib/images/public-image';
import type { PublicProfileTemplateProps } from '../contract';
import styles from './LiquidGlassTemplate.module.css';

export default function LiquidGlassTemplate({ viewModel, actions }: PublicProfileTemplateProps) {
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
        <header className={`${styles.panel} ${styles.hero}`}>
          {profile.coverImage && (
            <Image
              src={profile.coverImage}
              alt=""
              width={1280}
              height={420}
              priority
              unoptimized={!isOptimizablePublicImage(profile.coverImage)}
              className={styles.cover}
            />
          )}
          <div className={styles.identity}>
            {profile.avatar ? (
              <Image
                src={profile.avatar}
                alt={`${profile.fullName}'s profile photo`}
                width={144}
                height={144}
                priority
                unoptimized={!isOptimizablePublicImage(profile.avatar)}
                className={styles.avatar}
              />
            ) : (
              <span className={styles.avatarFallback} aria-hidden="true">
                {profile.fullName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className={styles.identityText}>
              <h1 className={styles.name}>{profile.fullName}</h1>
              {profile.jobTitle && <p className={styles.title}>{profile.jobTitle}</p>}
              {profile.skillsLine && <p className={styles.skills}>{profile.skillsLine}</p>}
            </div>
          </div>
          {profile.tagline && <p className={styles.tagline}>{profile.tagline}</p>}
          <div className={styles.actions}>
            <button type="button" className={styles.button} onClick={actions.downloadContact}>
              Download contact
            </button>
            {profile.phone && (
              <a className={styles.button} href={`tel:${profile.phone}`}>
                Call
              </a>
            )}
            {profile.email && (
              <a className={styles.button} href={`mailto:${profile.email}`}>
                Email
              </a>
            )}
            {socialLinks.map((item) => (
              <a
                key={item.platform}
                className={styles.button}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatPlatform(item.platform)}
              </a>
            ))}
          </div>
        </header>

        <div className={styles.contactGrid}>
          {sections.contact && (
            <section
              className={`${styles.panel} ${styles.section}`}
              aria-labelledby="liquid-contact"
            >
              <h2 id="liquid-contact" className={styles.sectionTitle}>
                Contact
              </h2>
              <dl className={styles.contactList}>
                {profile.phone && (
                  <ContactItem label="Phone">
                    <a href={`tel:${profile.phone}`}>{profile.phone}</a>
                  </ContactItem>
                )}
                {profile.email && (
                  <ContactItem label="Email">
                    <a href={`mailto:${profile.email}`}>{profile.email}</a>
                  </ContactItem>
                )}
                {profile.location && <ContactItem label="Location">{profile.location}</ContactItem>}
                {profile.website && (
                  <ContactItem label="Website">
                    <a href={profile.website} target="_blank" rel="noopener noreferrer">
                      {profile.website}
                    </a>
                  </ContactItem>
                )}
              </dl>
            </section>
          )}

          <section className={`${styles.panel} ${styles.section}`} aria-labelledby="liquid-qr">
            <h2 id="liquid-qr" className={styles.sectionTitle}>
              Save contact
            </h2>
            <p className={styles.muted}>Scan to save {profile.fullName} to your contacts.</p>
            <div className={styles.qrFrame}>
              {actions.qrDataUrl ? (
                <Image
                  src={actions.qrDataUrl}
                  alt={`QR code for ${profile.fullName}'s contact`}
                  width={192}
                  height={192}
                  unoptimized
                />
              ) : actions.qrError ? (
                <p role="alert">{actions.qrError}</p>
              ) : (
                <p role="status">Preparing QR code…</p>
              )}
            </div>
          </section>
        </div>

        {sections.office && office && (
          <section className={`${styles.panel} ${styles.section}`} aria-labelledby="liquid-office">
            <h2 id="liquid-office" className={styles.sectionTitle}>
              Office
            </h2>
            {office.companyName && <p className={styles.officeName}>{office.companyName}</p>}
            {office.designation && <p>{office.designation}</p>}
            {office.department && <p>{office.department}</p>}
            {office.officeAddress && <p className={styles.officeAddress}>{office.officeAddress}</p>}
            {office.workingHours && <p>{office.workingHours}</p>}
            <div className={styles.officeLinks}>
              {office.officePhone && <a href={`tel:${office.officePhone}`}>{office.officePhone}</a>}
              {office.officeEmail && (
                <a href={`mailto:${office.officeEmail}`}>{office.officeEmail}</a>
              )}
              {office.companyWebsite && (
                <a href={office.companyWebsite} target="_blank" rel="noopener noreferrer">
                  Company website
                </a>
              )}
            </div>
          </section>
        )}

        {sections.products && (
          <section
            className={`${styles.panel} ${styles.section}`}
            aria-labelledby="liquid-products"
          >
            <h2 id="liquid-products" className={styles.sectionTitle}>
              Products &amp; Services
            </h2>
            <ul className={styles.products}>
              {products.map((product) => (
                <li key={product.id} className={styles.product}>
                  <Image
                    src={product.image}
                    alt={product.name}
                    width={640}
                    height={480}
                    loading="lazy"
                    unoptimized={!isOptimizablePublicImage(product.image)}
                    className={styles.productImage}
                  />
                  <div className={styles.productBody}>
                    <h3>{product.name}</h3>
                    {product.price !== null && product.price !== undefined && (
                      <p className={styles.price}>
                        {product.currency} {product.price}
                      </p>
                    )}
                    {product.detail && <p className={styles.productDetail}>{product.detail}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className={`${styles.panel} ${styles.section}`} aria-labelledby="liquid-links">
          <h2 id="liquid-links" className={styles.sectionTitle}>
            Quick links
          </h2>
          <div className={styles.actions}>
            {profile.phone && (
              <a className={styles.button} href={`tel:${profile.phone}`}>
                Call
              </a>
            )}
            {profile.email && (
              <a className={styles.button} href={`mailto:${profile.email}`}>
                Email
              </a>
            )}
            {profile.website && (
              <a
                className={styles.button}
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
                className={styles.button}
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {formatPlatform(item.platform)}
              </a>
            ))}
            <button type="button" className={styles.button} onClick={actions.downloadCsv}>
              Download CSV
            </button>
          </div>
        </section>

        {sections.gallery && (
          <section className={`${styles.panel} ${styles.section}`} aria-labelledby="liquid-gallery">
            <h2 id="liquid-gallery" className={styles.sectionTitle}>
              Gallery
            </h2>
            <div className={styles.gallery}>
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
                    className={styles.galleryImage}
                  />
                  {image.caption && <span className={styles.galleryCaption}>{image.caption}</span>}
                </button>
              ))}
            </div>
          </section>
        )}

        <footer className={styles.footer}>
          © {new Date().getFullYear()} {profile.fullName}
        </footer>
      </article>

      {galleryIndex !== null && profile.galleryImages[galleryIndex] && (
        <div
          className={styles.lightbox}
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
            className={styles.lightboxClose}
            aria-label="Close image viewer"
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
            className={styles.lightboxImage}
          />
        </div>
      )}
    </main>
  );
}

function ContactItem({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className={styles.contactItem}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function formatPlatform(platform: string): string {
  return platform === 'X' ? 'X' : `${platform.charAt(0)}${platform.slice(1).toLowerCase()}`;
}
