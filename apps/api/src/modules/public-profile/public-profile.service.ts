import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardStatus, type Profile } from '@prisma/client';
import {
  PublicProfileApiSchema,
  PublicProfileResponseSchema,
  DEFAULT_PROFILE_THEME_COLOR,
  type PublicProfileApi,
  type PublicProfileResponse,
} from '@nfc/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import type { ApiEnvironment } from '../../config/env.schema';
import { AnalyticsService } from '../analytics/analytics.service';

type PublicProfileDto = PublicProfileApi;

type ResolvedProfile =
  | { kind: 'profile'; profileId: string; cardId: string | null; profile: PublicProfileDto }
  | { kind: 'redirect'; slug: string }
  | { kind: 'not-found' };

type PublicProfileRecord = Profile & {
  gallery: Array<{
    objectKey: string;
    altText: string | null;
    caption: string | null;
    position: number;
  }>;
};

@Injectable()
export class PublicProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly analytics: AnalyticsService,
    private readonly config: ConfigService<ApiEnvironment, true>,
  ) {}

  async getBySlug(slug: string): Promise<PublicProfileResponse> {
    const resolved = await this.resolve(slug);

    if (resolved.kind === 'not-found') {
      throw new NotFoundException('Profile not found.');
    }
    if (resolved.kind === 'redirect') return PublicProfileResponseSchema.parse(resolved);
    return PublicProfileResponseSchema.parse({ kind: 'profile', profile: resolved.profile });
  }

  async recordView(slug: string, request: Request): Promise<void> {
    const resolved = await this.resolve(slug);
    if (resolved.kind === 'not-found') throw new NotFoundException('Profile not found.');
    if (resolved.kind === 'redirect') return;
    await this.analytics.recordPublicView(resolved.profileId, resolved.cardId, request);
  }

  private async resolve(slug: string): Promise<ResolvedProfile> {
    return this.resolveFromDatabase(slug);
  }

  private async resolveFromDatabase(slug: string): Promise<ResolvedProfile> {
    const galleryMax = this.config.get('GALLERY_MAX_IMAGES', { infer: true });
    const card = await this.prisma.card.findUnique({
      where: { slug },
      select: { id: true, profileId: true, status: true, deletedAt: true },
    });

    let profile: PublicProfileRecord | null = null;
    let cardId: string | null = null;
    if (card) {
      if (card.status === CardStatus.ACTIVE && card.deletedAt === null && card.profileId !== null) {
        profile = await this.prisma.profile.findUnique({
          where: { id: card.profileId },
          include: {
            gallery: {
              where: { deletedAt: null },
              orderBy: { position: 'asc' },
              take: galleryMax,
            },
          },
        });
        cardId = card.id;
      }
    } else {
      profile = await this.prisma.profile.findUnique({
        where: { slug },
        include: {
          gallery: {
            where: { deletedAt: null },
            orderBy: { position: 'asc' },
            take: galleryMax,
          },
        },
      });
    }

    let resolved: ResolvedProfile;
    if (profile && profile.isPublic) {
      resolved = {
        kind: 'profile',
        profileId: profile.id,
        cardId,
        profile: this.toPublicDto(profile),
      };
    } else if (!card) {
      const redirect = await this.prisma.profileSlugRedirect.findUnique({
        where: { oldSlug: slug },
        select: { newSlug: true, profile: { select: { isPublic: true } } },
      });
      resolved =
        redirect?.profile.isPublic === true
          ? { kind: 'redirect', slug: redirect.newSlug }
          : { kind: 'not-found' };
    } else {
      resolved = { kind: 'not-found' };
    }
    return resolved;
  }

  private toPublicDto(profile: PublicProfileRecord): PublicProfileDto {
    return PublicProfileApiSchema.parse({
      slug: profile.slug,
      fullName: profile.displayName?.trim().slice(0, 100) || profile.slug,
      jobTitle: profile.title,
      skillsLine: profile.skillsLine,
      tagline: profile.tagline,
      avatar: this.isR2PublicUrl(profile.avatarUrl) ? profile.avatarUrl : null,
      coverImage: this.isR2PublicUrl(profile.coverImageUrl) ? profile.coverImageUrl : null,
      phone: profile.phone,
      email: this.publicEmail(profile.email),
      location: profile.location,
      website: this.publicHttpsUrl(profile.website),
      linkedinUrl: this.publicSocialUrl(profile.linkedinUrl, 'linkedin.com'),
      githubUrl: this.publicSocialUrl(profile.githubUrl, 'github.com'),
      galleryImages: profile.gallery.map((image) => ({
        url: this.publicAssetUrl(image.objectKey),
        alt: (image.altText ?? '').slice(0, 160),
        caption: image.caption?.slice(0, 300) ?? null,
      })),
      themeColor: /^#[0-9a-fA-F]{6}$/.test(profile.themeColor)
        ? profile.themeColor
        : DEFAULT_PROFILE_THEME_COLOR,
      isIndexable: profile.isIndexable,
    });
  }

  private publicAssetUrl(objectKey: string): string {
    const baseUrl = this.config.get('R2_PUBLIC_BASE_URL', { infer: true }).replace(/\/+$/, '');
    if (!baseUrl) throw new InternalServerErrorException('R2_PUBLIC_BASE_URL is not configured.');
    return `${baseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  private isR2PublicUrl(value: string | null): value is string {
    if (!value) return false;
    const baseUrl = this.config.get('R2_PUBLIC_BASE_URL', { infer: true }).replace(/\/+$/, '');
    return baseUrl !== '' && value.startsWith(`${baseUrl}/`);
  }

  private publicHttpsUrl(value: string | null): string | null {
    if (!value) return null;
    try {
      return new URL(value).protocol === 'https:' ? value : null;
    } catch {
      return null;
    }
  }

  private publicEmail(value: string | null): string | null {
    if (!value) return null;
    const parsed = z.string().email().max(254).safeParse(value);
    return parsed.success ? parsed.data.toLowerCase() : null;
  }

  private publicSocialUrl(value: string | null, hostname: string): string | null {
    const safeUrl = this.publicHttpsUrl(value);
    if (!safeUrl) return null;
    const host = new URL(safeUrl).hostname.toLowerCase();
    return host === hostname || host === `www.${hostname}` ? safeUrl : null;
  }
}
