import { describe, expect, it } from 'vitest';
import {
  CardDataSchema,
  CardOfficeSchema,
  CardProductSchema,
  CardProductUpdateSchema,
  CardProfileDataSchema,
  CardProductsSchema,
} from './cards';

describe('card schemas', () => {
  it('requires a valid purpose and a custom label only for Other', () => {
    expect(CardDataSchema.safeParse({ slug: 'ada-lovelace', purpose: 'PERSONAL' }).success).toBe(
      true,
    );
    expect(CardDataSchema.safeParse({ slug: 'ada-lovelace', purpose: 'OTHER' }).success).toBe(
      false,
    );
    expect(
      CardDataSchema.safeParse({
        slug: 'ada-lovelace',
        purpose: 'OTHER',
        customPurpose: 'Consultant',
      }).success,
    ).toBe(true);
    expect(
      CardDataSchema.safeParse({
        slug: 'admin',
        purpose: 'PERSONAL',
      }).success,
    ).toBe(false);
  });

  it('requires valid profile phone formats and the correct HTTPS social domains', () => {
    const profile = {
      fullName: 'Ada Lovelace',
      contact: { phone: '+94771234567' },
      socialLinks: [{ platform: 'LINKEDIN', url: 'https://linkedin.com/in/ada' }],
      themeColor: '#4f46e5',
      gallery: [],
      showProducts: false,
    };
    expect(CardProfileDataSchema.safeParse(profile).success).toBe(true);
    expect(CardProfileDataSchema.safeParse({ ...profile, templateId: 'editorial' }).success).toBe(
      true,
    );
    expect(CardProfileDataSchema.safeParse({ ...profile, templateId: 'unknown' }).success).toBe(
      false,
    );
    expect(
      CardProfileDataSchema.safeParse({
        ...profile,
        contact: { phone: '0771234567' },
      }).success,
    ).toBe(false);
    expect(
      CardProfileDataSchema.safeParse({
        ...profile,
        socialLinks: [{ platform: 'LINKEDIN', url: 'https://linkedin.com.attacker.invalid/a' }],
      }).success,
    ).toBe(false);
    expect(
      CardProfileDataSchema.safeParse({
        ...profile,
        socialLinks: [{ platform: 'GITHUB', url: 'http://github.com/ada' }],
      }).success,
    ).toBe(false);
    expect(
      CardProfileDataSchema.safeParse({
        ...profile,
        socialLinks: [{ platform: 'GITHUB', url: 'https://' }],
      }).success,
    ).toBe(false);
  });

  it('validates office contact details and requires a company when enabled', () => {
    expect(CardOfficeSchema.safeParse({ hasOffice: false }).success).toBe(true);
    expect(
      CardOfficeSchema.safeParse({ hasOffice: true, companyName: 'Analytical Engine Ltd.' })
        .success,
    ).toBe(true);
    expect(CardOfficeSchema.safeParse({ hasOffice: true }).success).toBe(false);
    expect(
      CardOfficeSchema.safeParse({
        hasOffice: true,
        companyName: 'Analytical Engine Ltd.',
        officePhone: '+9477123456789012',
      }).success,
    ).toBe(false);
  });

  it('enforces product URL, name/detail lengths, currency and the five-product cap', () => {
    const product = {
      image: 'https://cdn.example.com/product.png',
      name: 'Engine',
      price: 12.5,
      currency: 'USD',
      detail: 'A precision engine.',
      sortOrder: 0,
    };
    expect(CardProductSchema.safeParse(product).success).toBe(true);
    const noPrice = CardProductSchema.safeParse({
      image: product.image,
      name: product.name,
      currency: product.currency,
      detail: product.detail,
      sortOrder: 0,
    });
    expect(noPrice.success).toBe(true);
    if (noPrice.success) expect(noPrice.data).not.toHaveProperty('price');
    const missingImage = CardProductSchema.safeParse({ ...product, image: '' });
    expect(missingImage.success).toBe(false);
    if (!missingImage.success) {
      expect(missingImage.error.issues).toHaveLength(1);
      expect(missingImage.error.issues[0]?.message).toBe('Choose a photo before saving.');
    }
    const missingName = CardProductSchema.safeParse({ ...product, name: '' });
    expect(missingName.success).toBe(false);
    if (!missingName.success) {
      expect(missingName.error.issues[0]?.message).toBe(
        'Enter a name for this product or service.',
      );
    }
    expect(CardProductSchema.safeParse({ ...product, price: -1 }).success).toBe(false);
    expect(CardProductSchema.safeParse({ ...product, price: 12.345 }).success).toBe(false);
    expect(CardProductUpdateSchema.safeParse({}).success).toBe(false);
    expect(CardProductUpdateSchema.safeParse({ price: null }).success).toBe(true);
    expect(CardProductSchema.safeParse({ ...product, currency: 'usd' }).success).toBe(false);
    expect(CardProductSchema.safeParse({ ...product, detail: 'x'.repeat(121) }).success).toBe(
      false,
    );
    expect(CardProductsSchema.safeParse(Array.from({ length: 5 }, () => product)).success).toBe(
      true,
    );
    const tooManyItems = CardProductsSchema.safeParse(Array.from({ length: 6 }, () => product));
    expect(tooManyItems.success).toBe(false);
    if (!tooManyItems.success) {
      expect(tooManyItems.error.issues[0]?.message).toBe(
        'Add no more than five products or services.',
      );
    }
    const invalidList = CardProductsSchema.safeParse([{ ...product, image: '' }]);
    expect(invalidList.success).toBe(false);
    if (!invalidList.success) {
      expect(invalidList.error.issues[0]?.path).toEqual([0, 'image']);
      expect(invalidList.error.issues[0]?.message).toBe('Choose a photo before saving.');
    }
  });
});
