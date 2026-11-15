import { ConflictException, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { ProfileUpdateApiSchema } from '@nfc/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';
import { ProfilesService } from './profiles.service';

const profile = {
  id: 'profile-id',
  userId: 'owner-id',
  slug: 'old-slug',
  theme: {},
};

function serviceWith(prisma: object) {
  return new ProfilesService(
    prisma as PrismaService,
    { revalidate: vi.fn() } as unknown as WebRevalidationService,
  );
}

describe('ProfilesService', () => {
  it('validates slugs at the request boundary', () => {
    expect(ProfileUpdateApiSchema.safeParse({ slug: 'valid-slug-2' }).success).toBe(true);
    expect(ProfileUpdateApiSchema.safeParse({ slug: 'Not Valid' }).success).toBe(false);
    expect(ProfileUpdateApiSchema.safeParse({ slug: 'a' }).success).toBe(false);
  });

  it('loads only the authenticated owner profile', async () => {
    const findUnique = vi.fn().mockResolvedValue(null);
    const profiles = serviceWith({ profile: { findUnique } });
    await expect(profiles.getMine('authenticated-owner')).rejects.toBeInstanceOf(NotFoundException);
    expect(findUnique).toHaveBeenCalledWith({ where: { userId: 'authenticated-owner' } });
  });

  it('rejects a slug already owned by another profile', async () => {
    const findProfile = vi
      .fn()
      .mockResolvedValueOnce(profile)
      .mockResolvedValueOnce({ id: 'other' });
    const findRedirect = vi.fn().mockResolvedValue(null);
    const profiles = serviceWith({
      profile: { findUnique: findProfile },
      profileSlugRedirect: { findUnique: findRedirect },
      card: { findUnique: vi.fn().mockResolvedValue(null) },
    });

    await expect(profiles.updateMine('owner-id', { slug: 'taken-slug' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(findProfile).toHaveBeenNthCalledWith(1, { where: { userId: 'owner-id' } });
    expect(findProfile).toHaveBeenNthCalledWith(2, {
      where: { slug: 'taken-slug' },
      select: { id: true },
    });
  });

  it('rejects reserved slugs before persisting changes', async () => {
    const findProfile = vi.fn().mockResolvedValue(profile);
    const profiles = serviceWith({ profile: { findUnique: findProfile } });
    await expect(profiles.updateMine('owner-id', { slug: 'admin' })).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(findProfile).toHaveBeenCalledTimes(1);
  });

  it('saves normalized fixed-profile fields and theme color', async () => {
    const storedProfile = {
      ...profile,
      displayName: 'Ada Lovelace',
      title: 'Engineer',
      skillsLine: 'TypeScript | ERP',
      tagline: 'Building useful software',
      avatarUrl: null,
      coverImageUrl: null,
      phone: '+94771234567',
      email: 'ada@example.com',
      location: 'Colombo',
      website: 'https://example.com',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      githubUrl: 'https://github.com/ada',
      themeColor: '#059669',
      profileType: 'PERSONAL',
      isPublic: true,
      isIndexable: true,
    };
    const profileUpdate = vi.fn().mockResolvedValue(undefined);
    const profileFindUnique = vi.fn().mockResolvedValue(storedProfile);
    const transaction = { profile: { update: profileUpdate } };
    const prisma = {
      profile: { findUnique: profileFindUnique },
      $transaction: vi.fn((callback: (tx: object) => Promise<void>) => callback(transaction)),
      card: { findMany: vi.fn().mockResolvedValue([]) },
    };
    const revalidate = vi.fn().mockResolvedValue(undefined);
    const profiles = new ProfilesService(
      prisma as unknown as PrismaService,
      { revalidate } as unknown as WebRevalidationService,
    );

    const input = ProfileUpdateApiSchema.parse({
      slug: 'old-slug',
      fullName: 'Ada Lovelace',
      jobTitle: 'Engineer',
      skillsLine: 'TypeScript | ERP',
      tagline: 'Building useful software',
      phone: '+94 77-123-4567',
      email: 'ADA@EXAMPLE.COM',
      location: 'Colombo',
      website: 'https://example.com',
      linkedinUrl: 'https://www.linkedin.com/in/ada',
      githubUrl: 'https://github.com/ada',
      themeColor: '#059669',
    });

    await profiles.updateMine('owner-id', input);

    expect(profileUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'profile-id' },
        data: expect.objectContaining({
          displayName: 'Ada Lovelace',
          title: 'Engineer',
          skillsLine: 'TypeScript | ERP',
          tagline: 'Building useful software',
          phone: '+94771234567',
          email: 'ada@example.com',
          location: 'Colombo',
          website: 'https://example.com',
          linkedinUrl: 'https://www.linkedin.com/in/ada',
          githubUrl: 'https://github.com/ada',
          themeColor: '#059669',
        }),
      }),
    );
    expect(revalidate).toHaveBeenCalledWith(['old-slug']);
  });
});
