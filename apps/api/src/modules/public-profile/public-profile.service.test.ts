import { NotFoundException } from '@nestjs/common';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { AnalyticsService } from '../analytics/analytics.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PublicProfileService } from './public-profile.service';

const profileId = 'fbde5b86-4934-4c31-a03f-b6fcfa62c8e0';

const profile = {
  id: profileId,
  userId: 'private-owner-id',
  slug: 'sample-profile',
  displayName: 'Sample Person',
  title: 'Engineer',
  bio: 'Public bio',
  avatarUrl: null,
  tagline: 'Building',
  skillsLine: 'TypeScript | ERP',
  coverImageUrl: null,
  phone: null,
  email: null,
  location: null,
  website: null,
  linkedinUrl: null,
  githubUrl: null,
  themeColor: '#4f46e5',
  isPublic: true,
  isIndexable: false,
  contact: {
    email: 'private@example.com',
    phone: '+15555550123',
    website: 'https://private.example',
    showEmail: false,
    showPhone: false,
    showWebsite: false,
  },
  gallery: [],
};

function setup({
  card = null,
  resolvedProfile = profile,
  redirect = null,
}: {
  card?: object | null;
  resolvedProfile?: object | null;
  redirect?: object | null;
} = {}) {
  const prisma = {
    card: { findUnique: vi.fn().mockResolvedValue(card) },
    profile: { findUnique: vi.fn().mockResolvedValue(resolvedProfile) },
    profileSlugRedirect: { findUnique: vi.fn().mockResolvedValue(redirect) },
  };
  const analytics = { recordPublicView: vi.fn().mockResolvedValue(undefined) };
  return {
    service: new PublicProfileService(
      prisma as unknown as PrismaService,
      analytics as unknown as AnalyticsService,
      {
        get: vi.fn((key: string) =>
          key === 'GALLERY_MAX_IMAGES' ? 30 : 'https://cdn.example.com',
        ),
      } as never,
    ),
    prisma,
    analytics,
  };
}

const request = { headers: {}, ip: '203.0.113.9' } as Request;

describe('PublicProfileService', () => {
  it('returns only an explicit public projection from the database', async () => {
    const { service, prisma, analytics } = setup();

    const result = await service.getBySlug('sample-profile');

    expect(result).toMatchObject({
      kind: 'profile',
      profile: {
        slug: 'sample-profile',
        fullName: 'Sample Person',
        isIndexable: false,
        phone: null,
        email: null,
      },
    });
    expect(result).not.toHaveProperty('profile.id');
    expect(result).not.toHaveProperty('profile.userId');
    expect(JSON.stringify(result)).not.toContain('private@example.com');
    expect(result).not.toHaveProperty('profile.widgets');
    expect(result).not.toHaveProperty('profile.theme');
    expect(prisma.profile.findUnique).toHaveBeenCalled();
    expect(analytics.recordPublicView).not.toHaveBeenCalled();
  });

  it('queues a view against the resolved profile and card identifiers', async () => {
    const cardId = 'c1074dc6-df59-4e7d-b138-4b9ab046ad6d';
    const { service, analytics } = setup({
      card: { id: cardId, profileId, status: 'ACTIVE', deletedAt: null },
    });

    await service.recordView('opaque-card-slug', request);

    expect(analytics.recordPublicView).toHaveBeenCalledWith(profileId, cardId, request);
  });

  it('returns the same not-found response for unknown and inactive card slugs', async () => {
    const unknown = setup({ resolvedProfile: null });
    const inactive = setup({
      card: {
        id: 'c1074dc6-df59-4e7d-b138-4b9ab046ad6d',
        profileId: null,
        status: 'INACTIVE',
        deletedAt: null,
      },
      resolvedProfile: null,
    });

    const unknownError = await unknown.service
      .getBySlug('unissued-slug')
      .catch((error: unknown) => error);
    const inactiveError = await inactive.service
      .getBySlug('inactive-card-slug')
      .catch((error: unknown) => error);

    expect(unknownError).toBeInstanceOf(NotFoundException);
    expect(inactiveError).toBeInstanceOf(NotFoundException);
    expect((unknownError as NotFoundException).getStatus()).toBe(404);
    expect((inactiveError as NotFoundException).getStatus()).toBe(404);
    expect(unknownError.message).toBe(inactiveError.message);
    expect(unknown.prisma.card.findUnique).toHaveBeenCalled();
    expect(inactive.prisma.card.findUnique).toHaveBeenCalled();
  });

  it.each(['SUSPENDED', 'LOST'])('returns the same 404 for a %s card', async (status) => {
    const { service } = setup({
      card: {
        id: 'c1074dc6-df59-4e7d-b138-4b9ab046ad6d',
        profileId,
        status,
        deletedAt: null,
      },
      resolvedProfile: null,
    });

    await expect(service.getBySlug('unavailable-card-slug')).rejects.toMatchObject({
      status: 404,
      message: 'Profile not found.',
    });
  });

  it('returns fixed contact fields from the dedicated profile columns', async () => {
    const { service } = setup({
      resolvedProfile: {
        ...profile,
        email: 'public@example.com',
        phone: '+15555550123',
        website: 'https://public.example',
      },
    });

    const result = await service.getBySlug('sample-profile');

    expect(result).toMatchObject({
      kind: 'profile',
      profile: {
        email: 'public@example.com',
        phone: '+15555550123',
        website: 'https://public.example',
      },
    });
  });

  it('maps public gallery images and caps them at GALLERY_MAX_IMAGES', async () => {
    const { service, prisma } = setup({
      resolvedProfile: {
        ...profile,
        gallery: [
          {
            objectKey: 'users/owner/gallery/photo.webp',
            altText: 'At the conference',
            caption: 'Speaking at a conference',
            position: 0,
          },
        ],
      },
    });

    await expect(service.getBySlug('sample-profile')).resolves.toMatchObject({
      kind: 'profile',
      profile: {
        galleryImages: [
          {
            url: 'https://cdn.example.com/users/owner/gallery/photo.webp',
            alt: 'At the conference',
            caption: 'Speaking at a conference',
          },
        ],
      },
    });
    expect(prisma.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: {
          gallery: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
            take: 30,
          },
        },
      }),
    );
  });

  it('omits legacy URLs that do not meet the HTTPS and social-host rules', async () => {
    const { service } = setup({
      resolvedProfile: {
        ...profile,
        website: 'javascript:alert(1)',
        linkedinUrl: 'https://linkedin.com.attacker.invalid/in/ada',
        githubUrl: 'http://github.com/ada',
      },
    });

    await expect(service.getBySlug('sample-profile')).resolves.toMatchObject({
      kind: 'profile',
      profile: {
        website: null,
        linkedinUrl: null,
        githubUrl: null,
      },
    });
  });

  it('redirects a legacy slug only when its current profile is public', async () => {
    const { service } = setup({
      resolvedProfile: null,
      redirect: { newSlug: 'sample-profile', profile: { isPublic: true } },
    });

    await expect(service.getBySlug('old-sample')).resolves.toEqual({
      kind: 'redirect',
      slug: 'sample-profile',
    });
  });

  it('resolves the profile from PostgreSQL for each request', async () => {
    const { service, prisma } = setup();

    await service.getBySlug('sample-profile');

    expect(prisma.card.findUnique).toHaveBeenCalledWith({
      where: { slug: 'sample-profile' },
      select: { id: true, profileId: true, status: true, deletedAt: true },
    });
    expect(prisma.profile.findUnique).toHaveBeenCalled();
  });
});
