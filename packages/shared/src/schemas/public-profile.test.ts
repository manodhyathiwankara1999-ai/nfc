import { describe, expect, it } from 'vitest';
import { PublicCardResponseSchema, PublicProfileApiSchema } from './public-profile';

const activeCard = {
  slug: 'ada-lovelace',
  status: 'active',
  profile: {
    fullName: 'Ada Lovelace',
    contact: {},
    socialLinks: [],
    themeColor: '#4f46e5',
    gallery: [],
    showProducts: false,
  },
  office: null,
  products: [],
};

describe('public card response schema', () => {
  it('accepts full data for active cards', () => {
    expect(PublicCardResponseSchema.safeParse(activeCard).success).toBe(true);
  });

  it('accepts only the name and inactive status for inactive cards', () => {
    expect(
      PublicCardResponseSchema.safeParse({ status: 'inactive', name: 'Ada Lovelace' }).success,
    ).toBe(true);
    expect(
      PublicCardResponseSchema.safeParse({
        status: 'inactive',
        name: 'Ada Lovelace',
        profile: activeCard.profile,
      }).success,
    ).toBe(false);
  });

  it('defaults legacy public profile social links to an empty list', () => {
    const parsed = PublicProfileApiSchema.safeParse({
      slug: 'ada-lovelace',
      fullName: 'Ada Lovelace',
      jobTitle: null,
      skillsLine: null,
      tagline: null,
      avatar: null,
      coverImage: null,
      phone: null,
      email: null,
      location: null,
      website: null,
      linkedinUrl: null,
      githubUrl: null,
      galleryImages: [],
      themeColor: '#4f46e5',
      isIndexable: false,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.socialLinks).toEqual([]);
      expect(parsed.data.templateId).toBeNull();
    }
  });
});
