import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CardOfficeSchema } from '@nfc/shared';
import { CardPublicDetails } from './CardPublicDetails';

describe('card public details', () => {
  it('omits disabled office and empty products sections', () => {
    const markup = renderToStaticMarkup(
      createElement(CardPublicDetails, {
        office: CardOfficeSchema.parse({ hasOffice: false }),
        products: [],
        showProducts: true,
      }),
    );

    expect(markup).not.toContain('Office');
    expect(markup).not.toContain('Products &amp; Services');
  });

  it('renders product cards and omits the price when it is absent', () => {
    const markup = renderToStaticMarkup(
      createElement(CardPublicDetails, {
        office: null,
        showProducts: true,
        products: [
          {
            id: '00e3f63b-f18d-4c9d-bc62-ddf6d6c42e81',
            image: 'https://cdn.example.com/product.webp',
            name: 'Desk lamp',
            currency: 'USD',
            detail: 'Warm, adjustable light.',
          },
        ],
      }),
    );

    expect(markup).toContain('Products &amp; Services');
    expect(markup).toContain('Desk lamp');
    expect(markup).toContain('Warm, adjustable light.');
    expect(markup).not.toContain('USD');
    expect(markup).toContain('loading="lazy"');
  });
});
