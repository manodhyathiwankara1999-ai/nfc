import React from 'react';
import Image from 'next/image';
import type { CSSProperties } from 'react';
import type { CardOffice, CardProductResponse } from '@nfc/shared';
import { isOptimizablePublicImage } from '../../../lib/images/public-image';

type PublicProduct = Pick<
  CardProductResponse,
  'id' | 'image' | 'name' | 'price' | 'currency' | 'detail'
>;

export function CardPublicDetails({
  office,
  products,
  showProducts,
  productCardClassName = '',
  sectionClassName = '',
}: {
  office: CardOffice | null;
  products: PublicProduct[];
  showProducts: boolean;
  productCardClassName?: string;
  sectionClassName?: string;
}) {
  return (
    <div className="mx-auto grid max-w-4xl gap-5 px-4 pb-8 sm:px-8">
      {office?.hasOffice && (
        <section
          className={`${sectionClassName} rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur sm:p-7`}
        >
          <h2 className="text-lg font-semibold">Office</h2>
          {office.companyName && (
            <p className="mt-3 break-words font-medium">{office.companyName}</p>
          )}
          {office.designation && (
            <p className="mt-1 break-words text-sm text-slate-600">{office.designation}</p>
          )}
          {office.department && (
            <p className="mt-1 break-words text-sm text-slate-600">{office.department}</p>
          )}
          {office.officeAddress && (
            <p className="mt-3 whitespace-pre-line break-words text-sm text-slate-600">
              {office.officeAddress}
            </p>
          )}
          {office.workingHours && (
            <p className="mt-2 break-words text-sm text-slate-600">{office.workingHours}</p>
          )}
          {office.officePhone && (
            <a
              className="mt-3 inline-flex min-h-11 items-center break-all rounded-full bg-[var(--theme-soft)] px-4 py-2 text-sm font-medium text-[var(--theme-link)] hover:underline"
              href={`tel:${office.officePhone}`}
            >
              {office.officePhone}
            </a>
          )}
          {office.officeEmail && (
            <a
              className="mt-2 inline-flex min-h-11 items-center break-all text-sm text-[var(--theme-link)] hover:underline"
              href={`mailto:${office.officeEmail}`}
            >
              {office.officeEmail}
            </a>
          )}
          {office.companyWebsite && (
            <a
              className="mt-2 inline-flex min-h-11 items-center break-all text-sm text-[var(--theme-link)] hover:underline"
              href={office.companyWebsite}
              target="_blank"
              rel="noopener noreferrer"
            >
              Company website
            </a>
          )}
        </section>
      )}
      {showProducts && products.length > 0 && (
        <section
          className={`${sectionClassName} rounded-3xl border border-white/80 bg-white/85 p-5 shadow-lg shadow-slate-900/5 backdrop-blur sm:p-7`}
        >
          <h2 className="text-lg font-semibold">Products &amp; Services</h2>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {products.slice(0, 5).map((product, index) => (
              <li
                key={product.id}
                className={`${productCardClassName} overflow-hidden rounded-2xl border border-slate-200/80 bg-white`}
                style={{ '--product-order': index, '--reveal-order': index } as CSSProperties}
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-[var(--theme-soft)]">
                  {product.image ? (
                    <Image
                      src={product.image}
                      alt={product.name}
                      fill
                      sizes="(max-width: 640px) 90vw, (max-width: 1024px) 42vw, 300px"
                      loading="lazy"
                      unoptimized={!isOptimizablePublicImage(product.image)}
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-slate-600">
                      Photo
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-semibold">{product.name}</h3>
                    {product.price !== null && product.price !== undefined && (
                      <p className="shrink-0 rounded-full bg-[var(--theme-soft)] px-3 py-1 text-xs font-semibold text-[var(--theme-link)]">
                        {product.currency} {product.price}
                      </p>
                    )}
                  </div>
                  {product.detail && (
                    <p className="mt-2 break-words text-sm leading-6 text-slate-600">
                      {product.detail}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
