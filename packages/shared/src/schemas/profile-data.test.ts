import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROFILE_THEME_COLOR,
  ProfileDataSchema,
  ProfileImageUploadSchema,
} from './profile-data';

const validProfile = {
  fullName: '  Ada Lovelace  ',
  slug: 'ada-lovelace',
};

describe('ProfileDataSchema', () => {
  it('trims required identity fields and supplies safe defaults', () => {
    const result = ProfileDataSchema.parse(validProfile);

    expect(result.fullName).toBe('Ada Lovelace');
    expect(result.themeColor).toBe(DEFAULT_PROFILE_THEME_COLOR);
    expect(result.galleryImages).toEqual([]);
  });

  it('normalizes phone and email values', () => {
    const result = ProfileDataSchema.parse({
      ...validProfile,
      phone: '+94 77-123-4567',
      email: ' ADA@EXAMPLE.COM ',
    });

    expect(result.phone).toBe('+94771234567');
    expect(result.email).toBe('ada@example.com');
  });

  it('turns cleared optional contact and image URLs into null values', () => {
    const result = ProfileDataSchema.parse({
      ...validProfile,
      avatar: '',
      coverImage: '',
      website: '',
      linkedinUrl: '',
      githubUrl: '',
      email: '',
    });

    expect(result.avatar).toBeNull();
    expect(result.coverImage).toBeNull();
    expect(result.website).toBeNull();
    expect(result.linkedinUrl).toBeNull();
    expect(result.githubUrl).toBeNull();
    expect(result.email).toBeNull();
  });

  it.each(['', 'A', 'x'.repeat(101)])('rejects invalid full names', (fullName) => {
    expect(ProfileDataSchema.safeParse({ ...validProfile, fullName }).success).toBe(false);
  });

  it('limits skills to three non-empty values', () => {
    expect(
      ProfileDataSchema.safeParse({ ...validProfile, skillsLine: 'React | ERP | TypeScript' })
        .success,
    ).toBe(true);
    expect(
      ProfileDataSchema.safeParse({ ...validProfile, skillsLine: 'React, ERP, TypeScript, SQL' })
        .success,
    ).toBe(false);
  });

  it('requires HTTPS and validates social hosts', () => {
    expect(
      ProfileDataSchema.safeParse({
        ...validProfile,
        website: 'http://example.com',
        linkedinUrl: 'https://linkedin.com/in/ada',
      }).success,
    ).toBe(false);
    expect(
      ProfileDataSchema.safeParse({
        ...validProfile,
        linkedinUrl: 'https://linkedin.com.attacker.invalid/in/ada',
      }).success,
    ).toBe(false);
    expect(
      ProfileDataSchema.safeParse({
        ...validProfile,
        githubUrl: 'https://github.com/ada',
      }).success,
    ).toBe(true);
  });

  it('rejects reserved, malformed, and oversized slugs', () => {
    for (const slug of ['api', 'Ada', 'a', 'this-profile-slug-is-too-long-for-the-limit']) {
      expect(ProfileDataSchema.safeParse({ ...validProfile, slug }).success).toBe(false);
    }
  });

  it('rejects invalid theme colors and unsafe image schemes', () => {
    expect(ProfileDataSchema.safeParse({ ...validProfile, themeColor: 'red' }).success).toBe(false);
    expect(
      ProfileDataSchema.safeParse({ ...validProfile, avatar: 'javascript:alert(1)' }).success,
    ).toBe(false);
  });
});

describe('ProfileImageUploadSchema', () => {
  it('accepts a supported image within its kind-specific limit', () => {
    expect(
      ProfileImageUploadSchema.safeParse({
        kind: 'AVATAR',
        contentType: 'image/webp',
        size: 2 * 1024 * 1024,
      }).success,
    ).toBe(true);
  });

  it('rejects unsupported image types and files above the limit', () => {
    expect(
      ProfileImageUploadSchema.safeParse({
        kind: 'COVER',
        contentType: 'image/gif',
        size: 1024,
      }).success,
    ).toBe(false);
    expect(
      ProfileImageUploadSchema.safeParse({
        kind: 'AVATAR',
        contentType: 'image/jpeg',
        size: 2 * 1024 * 1024 + 1,
      }).success,
    ).toBe(false);
  });
});
