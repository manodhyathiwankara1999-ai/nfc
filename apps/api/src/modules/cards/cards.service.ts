import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CardCreator, CardStatus, Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { nanoid } from 'nanoid';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';

const claimHash = (claimCode: string) => createHash('sha256').update(claimCode).digest('hex');

type CardStatusDto = 'active' | 'inactive' | 'suspended' | 'lost' | 'deleted';

function statusDto(status: CardStatus): CardStatusDto {
  switch (status) {
    case CardStatus.ACTIVE:
      return 'active';
    case CardStatus.INACTIVE:
      return 'inactive';
    case CardStatus.SUSPENDED:
      return 'suspended';
    case CardStatus.LOST:
      return 'lost';
    case CardStatus.DELETED:
      return 'deleted';
  }
}

@Injectable()
export class CardsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: WebRevalidationService,
  ) {}

  async listMine(userId: string) {
    const cards = await this.prisma.card.findMany({
      where: { profile: { is: { userId } }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { slug: true, label: true, status: true, createdAt: true },
    });
    return cards.map((card) => ({ ...card, status: statusDto(card.status) }));
  }

  async create(actorId: string, label?: string) {
    const claimCode = randomBytes(32).toString('base64url');
    const slug = await this.newPublicSlug();
    const card = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.card.create({
        data: {
          slug,
          claimCodeHash: claimHash(claimCode),
          label,
          status: CardStatus.INACTIVE,
          createdBy: CardCreator.SUPER_ADMIN,
        },
        select: { slug: true, label: true, status: true, createdAt: true },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'card.created',
          entityType: 'card',
          entityId: created.slug,
          metadata: { status: CardStatus.INACTIVE },
        },
      });
      return created;
    });
    return { ...card, status: statusDto(card.status), claimCode };
  }

  private async newPublicSlug(): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const slug = nanoid(21);
      const [profile, redirect] = await Promise.all([
        this.prisma.profile.findUnique({ where: { slug }, select: { id: true } }),
        this.prisma.profileSlugRedirect.findUnique({
          where: { oldSlug: slug },
          select: { id: true },
        }),
      ]);
      if (!profile && !redirect) return slug;
    }
    throw new ConflictException('Could not generate an available card URL.');
  }

  async claim(userId: string, claimCode: string) {
    const codeHash = claimHash(claimCode);
    try {
      const card = await this.prisma.$transaction(async (transaction) => {
        const profile = await transaction.profile.findUnique({
          where: { userId },
          select: { id: true },
        });
        if (!profile) throw new NotFoundException('Profile not found.');

        const inactiveCard = await transaction.card.findUnique({
          where: { claimCodeHash: codeHash },
          select: {
            id: true,
            slug: true,
            label: true,
            status: true,
            profileId: true,
            deletedAt: true,
          },
        });
        if (
          !inactiveCard ||
          inactiveCard.status !== CardStatus.INACTIVE ||
          inactiveCard.profileId ||
          inactiveCard.deletedAt !== null
        ) {
          throw new NotFoundException('Claim code is invalid or has already been used.');
        }

        const updated = await transaction.card.updateMany({
          where: {
            id: inactiveCard.id,
            status: CardStatus.INACTIVE,
            profileId: null,
            claimCodeHash: codeHash,
            deletedAt: null,
          },
          data: {
            profileId: profile.id,
            status: CardStatus.ACTIVE,
            claimCodeHash: null,
          },
        });
        if (updated.count !== 1) {
          throw new ConflictException('This card has already been claimed.');
        }
        await transaction.auditLog.create({
          data: {
            actorId: userId,
            action: 'card.claimed',
            entityType: 'card',
            entityId: inactiveCard.slug,
            metadata: {},
          },
        });
        return {
          slug: inactiveCard.slug,
          label: inactiveCard.label,
          status: statusDto(CardStatus.ACTIVE),
        };
      });
      await this.invalidateCard(card.slug);
      return card;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('This card has already been claimed.');
      }
      throw error;
    }
  }

  async markLost(userId: string, slug: string) {
    const card = await this.prisma.card.findFirst({
      where: {
        slug,
        status: CardStatus.ACTIVE,
        deletedAt: null,
        profile: { is: { userId } },
      },
      select: { slug: true, profile: { select: { slug: true } } },
    });
    if (!card) throw new NotFoundException('Card not found.');
    const profileSlug = card.profile?.slug;

    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.card.updateMany({
        where: {
          slug,
          status: CardStatus.ACTIVE,
          profile: { is: { userId } },
        },
        data: { status: CardStatus.LOST, revokedAt: new Date() },
      });
      if (changed.count !== 1) throw new NotFoundException('Card not found.');
      await transaction.auditLog.create({
        data: {
          actorId: userId,
          action: 'card.marked_lost',
          entityType: 'card',
          entityId: slug,
          metadata: {},
        },
      });
    });
    await this.invalidateCard(slug, profileSlug);
    return { slug, status: statusDto(CardStatus.LOST) };
  }

  async suspend(actorId: string, slug: string) {
    const card = await this.prisma.card.findUnique({
      where: { slug },
      select: { slug: true, profile: { select: { slug: true } } },
    });
    if (!card) throw new NotFoundException('Card not found.');
    await this.prisma.$transaction(async (transaction) => {
      await transaction.card.update({
        where: { slug },
        data: { status: CardStatus.SUSPENDED, revokedAt: new Date() },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'card.suspended',
          entityType: 'card',
          entityId: slug,
          metadata: {},
        },
      });
    });
    await this.invalidateCard(slug, card.profile?.slug);
    return { slug, status: statusDto(CardStatus.SUSPENDED) };
  }

  private async invalidateCard(slug: string, profileSlug?: string): Promise<void> {
    await this.revalidation.revalidate([slug, ...(profileSlug ? [profileSlug] : [])]);
  }
}
