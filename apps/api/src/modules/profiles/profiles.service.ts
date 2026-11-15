import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, type Profile } from '@prisma/client';
import type { ProfileUpdateApi } from '@nfc/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';

const RESERVED_SLUGS = new Set([
  'admin',
  'api',
  'auth',
  'dashboard',
  'login',
  'register',
  'settings',
  'u',
  'user',
  'users',
  'verify-email',
  'forgot-password',
  'reset-password',
]);

export interface ProfileViewModel {
  id: string;
  userId: string;
  slug: string;
  fullName: string | null;
  jobTitle: string | null;
  skillsLine: string | null;
  tagline: string | null;
  avatar: string | null;
  coverImage: string | null;
  phone: string | null;
  email: string | null;
  location: string | null;
  website: string | null;
  linkedinUrl: string | null;
  githubUrl: string | null;
  themeColor: string;
  profileType: string;
  isPublic: boolean;
  isIndexable: boolean;
}

@Injectable()
export class ProfilesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: WebRevalidationService,
  ) {}

  async getMine(userId: string): Promise<ProfileViewModel> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
    });
    if (!profile) throw new NotFoundException('Profile not found.');
    return this.toView(profile);
  }

  async updateMine(userId: string, input: ProfileUpdateApi): Promise<ProfileViewModel> {
    const profile = await this.prisma.profile.findUnique({ where: { userId } });
    if (!profile) throw new NotFoundException('Profile not found.');

    const nextSlug = input.slug;
    if (nextSlug && nextSlug !== profile.slug) {
      if (RESERVED_SLUGS.has(nextSlug)) {
        throw new ConflictException('That profile URL is reserved.');
      }
      const [existing, redirect, card] = await Promise.all([
        this.prisma.profile.findUnique({ where: { slug: nextSlug }, select: { id: true } }),
        this.prisma.profileSlugRedirect.findUnique({
          where: { oldSlug: nextSlug },
          select: { id: true },
        }),
        this.prisma.card.findUnique({ where: { slug: nextSlug }, select: { id: true } }),
      ]);
      if (existing || redirect || card) {
        throw new ConflictException('That profile URL is already taken.');
      }
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.profile.update({
          where: { id: profile.id },
          data: {
            ...(input.fullName !== undefined ? { displayName: input.fullName } : {}),
            ...(input.jobTitle !== undefined ? { title: input.jobTitle || null } : {}),
            ...(input.skillsLine !== undefined ? { skillsLine: input.skillsLine || null } : {}),
            ...(input.tagline !== undefined ? { tagline: input.tagline || null } : {}),
            ...(input.avatar !== undefined ? { avatarUrl: input.avatar } : {}),
            ...(input.coverImage !== undefined ? { coverImageUrl: input.coverImage || null } : {}),
            ...(input.phone !== undefined ? { phone: input.phone || null } : {}),
            ...(input.email !== undefined ? { email: input.email || null } : {}),
            ...(input.location !== undefined ? { location: input.location || null } : {}),
            ...(input.website !== undefined ? { website: input.website || null } : {}),
            ...(input.linkedinUrl !== undefined ? { linkedinUrl: input.linkedinUrl || null } : {}),
            ...(input.githubUrl !== undefined ? { githubUrl: input.githubUrl || null } : {}),
            ...(input.isPublic !== undefined ? { isPublic: input.isPublic } : {}),
            ...(input.isIndexable !== undefined ? { isIndexable: input.isIndexable } : {}),
            ...(input.themeColor !== undefined ? { themeColor: input.themeColor } : {}),
            ...(nextSlug && nextSlug !== profile.slug ? { slug: nextSlug } : {}),
          },
        });

        if (nextSlug && nextSlug !== profile.slug) {
          await transaction.profileSlugRedirect.updateMany({
            where: { profileId: profile.id },
            data: { newSlug: nextSlug },
          });
          await transaction.profileSlugRedirect.create({
            data: { profileId: profile.id, oldSlug: profile.slug, newSlug: nextSlug },
          });
          await transaction.auditLog.create({
            data: {
              actorId: userId,
              action: 'profile.slug.changed',
              entityType: 'profile',
              entityId: profile.id,
              metadata: { oldSlug: profile.slug, newSlug: nextSlug },
            },
          });
        }
      });
    } catch (error) {
      if (
        nextSlug &&
        nextSlug !== profile.slug &&
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('That profile URL is already taken.');
      }
      throw error;
    }

    await this.invalidateProfileCache(profile.id, [profile.slug, nextSlug ?? profile.slug]);
    return this.getMine(userId);
  }

  private toView(profile: Profile): ProfileViewModel {
    return {
      id: profile.id,
      userId: profile.userId,
      slug: profile.slug,
      fullName: profile.displayName,
      jobTitle: profile.title,
      skillsLine: profile.skillsLine,
      tagline: profile.tagline,
      avatar: profile.avatarUrl,
      coverImage: profile.coverImageUrl,
      phone: profile.phone,
      email: profile.email,
      location: profile.location,
      website: profile.website,
      linkedinUrl: profile.linkedinUrl,
      githubUrl: profile.githubUrl,
      themeColor: profile.themeColor,
      profileType: String(profile.profileType),
      isPublic: profile.isPublic,
      isIndexable: profile.isIndexable,
    };
  }

  private async invalidateProfileCache(profileId: string, extraSlugs: string[]): Promise<void> {
    const cards = await this.prisma.card.findMany({
      where: { profileId },
      select: { slug: true },
    });
    const slugs = new Set([...extraSlugs, ...cards.map((card) => card.slug)]);
    await this.revalidation.revalidate([...slugs]);
  }
}
