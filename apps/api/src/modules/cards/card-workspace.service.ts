import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CardCreator, CardStatus, Prisma, type CardPurpose } from '@prisma/client';
import {
  CardOfficeSchema,
  CardProductSchema,
  CardProfileDataSchema,
  MAX_CARD_PRODUCTS,
  ProfileTemplateSelectionSchema,
  type CardData,
  type CardOffice,
  type CardProfileData,
} from '@nfc/shared';
import { randomUUID } from 'node:crypto';
import type { ApiEnvironment } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';
import { CardUploadsService } from './card-uploads.service';
import type {
  AdminCardCreateInput,
  AdminAuditSearchInput,
  AdminCardSearchInput,
  AdminCardUpdateInput,
  AdminUserSearchInput,
  CardOfficePatchInput,
  CardProfilePatchInput,
  ProductCreateInput,
  ProductReorderInput,
  ProductUpdateInput,
} from './cards.types';

const cardWorkspaceInclude = {
  owner: { select: { id: true, email: true, name: true } },
  cardProfile: {
    include: {
      office: true,
      products: {
        where: { deletedAt: null },
        orderBy: { sortOrder: 'asc' as const },
      },
    },
  },
};

type CardWithRelations = Prisma.CardGetPayload<{ include: typeof cardWorkspaceInclude }>;
type DbCardProduct = Prisma.CardProductGetPayload<Record<string, never>>;

const PRISMA_CARD_PURPOSES: Record<CardData['purpose'], CardPurpose> = {
  PERSONAL: 'PERSONAL',
  BUSINESS_OWNER: 'BUSINESS_OWNER',
  FREELANCER: 'FREELANCER',
  EMPLOYEE: 'EMPLOYEE',
  DOCTOR: 'DOCTOR',
  LAWYER: 'LAWYER',
  TEACHER: 'TEACHER',
  STUDENT: 'STUDENT',
  REAL_ESTATE: 'REAL_ESTATE',
  OTHER: 'OTHER',
};

@Injectable()
export class CardWorkspaceService {
  private readonly logger = new Logger(CardWorkspaceService.name);

  private readonly maxCardsPerUser: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService<ApiEnvironment, true>,
    private readonly revalidation: WebRevalidationService,
    private readonly uploads: CardUploadsService,
  ) {
    this.maxCardsPerUser = config.get('MAX_CARDS_PER_USER', { infer: true });
  }

  async listMine(ownerId: string) {
    const cards = await this.prisma.card.findMany({
      where: { ownerId, deletedAt: null, status: { not: CardStatus.DELETED } },
      include: cardWorkspaceInclude,
      orderBy: { createdAt: 'desc' },
    });
    return cards.map((card) => this.toCardResponse(card));
  }

  async getMine(ownerId: string, cardId: string) {
    const card = await this.findOwnedCard(ownerId, cardId);
    return this.toCardResponse(card);
  }

  async updateProfile(ownerId: string, cardId: string, patch: CardProfilePatchInput) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const baseline = this.profileDefaults(card);
    const currentProfile = card.cardProfile;
    const current = currentProfile
      ? this.parseProfile(currentProfile)
      : await this.profileDefaultsWithAccount(ownerId, baseline);
    const merged = CardProfileDataSchema.parse({
      ...current,
      ...patch,
      contact: { ...current.contact, ...patch.contact },
    });
    await this.assertProfileImages(ownerId, cardId, merged);

    const profileData = this.toProfileCreateData(merged);
    await this.prisma.cardProfile.upsert({
      where: { cardId },
      create: { cardId, ...profileData },
      update: profileData,
    });
    await this.invalidateCard(card.slug);
    return this.getMine(ownerId, cardId);
  }

  async updateCardDetails(ownerId: string, cardId: string, details: CardData) {
    const card = await this.findOwnedCard(ownerId, cardId);
    if (card.status !== CardStatus.ACTIVE && card.status !== CardStatus.INACTIVE) {
      throw new ConflictException('Only active or inactive cards can be edited by their owner.');
    }
    const updated = await this.prisma.card.updateMany({
      where: {
        id: cardId,
        ownerId,
        deletedAt: null,
        status: { in: [CardStatus.ACTIVE, CardStatus.INACTIVE] },
      },
      data: {
        slug: details.slug,
        purpose: PRISMA_CARD_PURPOSES[details.purpose],
        customPurpose: details.customPurpose ?? null,
      },
    });
    if (!updated.count) throw new NotFoundException('Card not found.');
    await this.invalidateCard(card.slug, details.slug);
    return this.getMine(ownerId, cardId);
  }

  async updateOffice(ownerId: string, cardId: string, patch: CardOfficePatchInput) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const cardProfile = await this.getOrCreateProfile(card);
    const currentOffice: CardOffice = card.cardProfile?.office
      ? this.parseOffice(card.cardProfile.office)
      : CardOfficeSchema.parse({ hasOffice: false });
    const office = CardOfficeSchema.parse({ ...currentOffice, ...patch });

    await this.prisma.cardOffice.upsert({
      where: { cardProfileId: cardProfile.id },
      create: {
        cardProfileId: cardProfile.id,
        ...office,
      },
      update: office,
    });
    await this.invalidateCard(card.slug);
    return this.getMine(ownerId, cardId);
  }

  async addProduct(ownerId: string, cardId: string, input: ProductCreateInput) {
    const card = await this.findOwnedCard(ownerId, cardId);
    await this.uploads.assertCardImage(ownerId, cardId, input.image, 'product');
    const profile = await this.getOrCreateProfile(card);
    const product = CardProductSchema.parse({
      ...input,
      sortOrder: 0,
    });

    await this.prisma.$transaction(async (transaction) => {
      await this.lockProductList(transaction, profile.id);
      const currentProducts = await transaction.cardProduct.findMany({
        where: { cardProfileId: profile.id, deletedAt: null },
        select: { sortOrder: true },
      });
      if (currentProducts.length >= MAX_CARD_PRODUCTS) {
        throw new ConflictException(
          `A card can have at most ${MAX_CARD_PRODUCTS} products or services.`,
        );
      }
      await transaction.cardProduct.create({
        data: {
          cardProfileId: profile.id,
          image: product.image,
          name: product.name,
          price: product.price ?? null,
          currency: product.currency,
          detail: product.detail,
          sortOrder: currentProducts.length,
        },
      });
    });
    await this.invalidateCard(card.slug);
    return this.getMine(ownerId, cardId);
  }

  async updateProduct(
    ownerId: string,
    cardId: string,
    productId: string,
    patch: ProductUpdateInput,
  ) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const profile = await this.requireCardProfile(card);
    const current = await this.prisma.cardProduct.findFirst({
      where: { id: productId, cardProfileId: profile.id, deletedAt: null },
    });
    if (!current) throw new NotFoundException('Product or service not found.');

    const next = CardProductSchema.parse({
      image: patch.image ?? current.image,
      name: patch.name ?? current.name,
      price: patch.price === undefined ? (current.price?.toNumber() ?? null) : patch.price,
      currency: patch.currency ?? current.currency,
      detail: patch.detail ?? current.detail,
      sortOrder: current.sortOrder,
    });
    if (patch.image !== undefined) {
      await this.uploads.assertCardImage(ownerId, cardId, next.image, 'product');
    }

    await this.prisma.cardProduct.updateMany({
      where: { id: productId, cardProfileId: profile.id, deletedAt: null },
      data: {
        image: next.image,
        name: next.name,
        price: next.price ?? null,
        currency: next.currency,
        detail: next.detail,
      },
    });
    await this.invalidateCard(card.slug);
    return this.getMine(ownerId, cardId);
  }

  async removeProduct(ownerId: string, cardId: string, productId: string) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const profile = await this.requireCardProfile(card);

    await this.prisma.$transaction(async (transaction) => {
      await this.lockProductList(transaction, profile.id);
      const product = await transaction.cardProduct.findFirst({
        where: { id: productId, cardProfileId: profile.id, deletedAt: null },
      });
      if (!product) throw new NotFoundException('Product or service not found.');
      await transaction.cardProduct.update({
        where: { id: productId },
        data: { deletedAt: new Date() },
      });
      const remaining = await transaction.cardProduct.findMany({
        where: { cardProfileId: profile.id, deletedAt: null },
        orderBy: { sortOrder: 'asc' },
        select: { id: true },
      });
      await this.persistProductOrder(
        transaction,
        profile.id,
        remaining.map(({ id }) => id),
      );
    });
    await this.invalidateCard(card.slug);
    return this.getMine(ownerId, cardId);
  }

  async reorderProducts(ownerId: string, cardId: string, productIds: ProductReorderInput) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const profile = await this.requireCardProfile(card);
    await this.prisma.$transaction(async (transaction) => {
      await this.lockProductList(transaction, profile.id);
      const existing = await transaction.cardProduct.findMany({
        where: { cardProfileId: profile.id, deletedAt: null },
        select: { id: true },
      });
      if (
        existing.length !== productIds.length ||
        existing.some(({ id }) => !productIds.includes(id))
      ) {
        throw new NotFoundException('The products or services list changed. Reload and try again.');
      }
      await this.persistProductOrder(transaction, profile.id, productIds);
    });
    await this.invalidateCard(card.slug);
    return this.getMine(ownerId, cardId);
  }

  async activate(ownerId: string, cardId: string) {
    return this.updateOwnedStatus(ownerId, cardId, CardStatus.ACTIVE);
  }

  async deactivate(ownerId: string, cardId: string) {
    return this.updateOwnedStatus(ownerId, cardId, CardStatus.INACTIVE);
  }

  async deleteMine(ownerId: string, cardId: string) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const deletedAt = new Date();
    const result = await this.prisma.card.updateMany({
      where: {
        id: cardId,
        ownerId,
        deletedAt: null,
        status: { not: CardStatus.DELETED },
      },
      data: { status: CardStatus.DELETED, deletedAt, revokedAt: deletedAt },
    });
    if (!result.count) throw new NotFoundException('Card not found.');
    await this.invalidateCard(card.slug);
    return { id: cardId, status: CardStatus.DELETED };
  }

  async adminListCards(input: AdminCardSearchInput) {
    const filters: Prisma.CardWhereInput[] = [];
    if (input.status) filters.push({ status: input.status });
    if (input.ownerEmail) {
      filters.push({
        owner: { is: { email: { contains: input.ownerEmail, mode: 'insensitive' } } },
      });
    }
    if (input.slug) {
      filters.push({ slug: { contains: input.slug, mode: 'insensitive' } });
    }
    if (input.name) {
      filters.push({
        OR: [
          { owner: { is: { name: { contains: input.name, mode: 'insensitive' } } } },
          {
            cardProfile: {
              is: { fullName: { contains: input.name, mode: 'insensitive' } },
            },
          },
        ],
      });
    }
    if (input.query) {
      filters.push({
        OR: [
          { slug: { contains: input.query, mode: 'insensitive' } },
          { owner: { is: { email: { contains: input.query, mode: 'insensitive' } } } },
          { owner: { is: { name: { contains: input.query, mode: 'insensitive' } } } },
          {
            cardProfile: {
              is: { fullName: { contains: input.query, mode: 'insensitive' } },
            },
          },
        ],
      });
    }
    const where: Prisma.CardWhereInput = filters.length ? { AND: filters } : {};
    const [total, cards] = await this.prisma.$transaction([
      this.prisma.card.count({ where }),
      this.prisma.card.findMany({
        where,
        include: cardWorkspaceInclude,
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return {
      items: cards.map((card) => this.toCardResponse(card)),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async adminCreateCard(actorId: string, input: AdminCardCreateInput) {
    const owner = await this.prisma.user.findFirst({
      where: { email: { equals: input.ownerEmail, mode: 'insensitive' }, deletedAt: null },
      select: { id: true },
    });
    if (!owner) throw new NotFoundException('User not found.');

    const slug = input.slug ?? `card-${randomUUID().replace(/-/g, '').slice(0, 24)}`;
    const created = await this.prisma.$transaction(async (transaction) => {
      await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${owner.id}))`;
      const cardCount = await transaction.card.count({
        where: {
          ownerId: owner.id,
          deletedAt: null,
          status: { not: CardStatus.DELETED },
        },
      });
      if (cardCount >= this.maxCardsPerUser) {
        throw new ConflictException(`User has reached the ${this.maxCardsPerUser}-card limit.`);
      }
      const card = await transaction.card.create({
        data: {
          ownerId: owner.id,
          slug,
          purpose: PRISMA_CARD_PURPOSES[input.purpose],
          customPurpose: input.customPurpose ?? null,
          createdBy: CardCreator.SUPER_ADMIN,
          status: CardStatus.ACTIVE,
        },
        include: cardWorkspaceInclude,
      });
      await this.createAuditLog(transaction, actorId, card.id, 'card.created', {
        ownerId: owner.id,
        purpose: input.purpose,
      });
      return card;
    });
    return this.toCardResponse(created);
  }

  async adminUpdateCard(actorId: string, cardId: string, input: AdminCardUpdateInput) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, deletedAt: null, status: { not: CardStatus.DELETED } },
      include: cardWorkspaceInclude,
    });
    if (!card) throw new NotFoundException('Card not found.');

    const baseProfile = card.cardProfile
      ? this.parseProfile(card.cardProfile)
      : input.profile || input.office || input.products
        ? await this.profileDefaultsWithAccount(card.ownerId ?? '', this.profileDefaults(card))
        : undefined;
    const mergedProfile =
      input.profile && baseProfile
        ? CardProfileDataSchema.parse({
            ...baseProfile,
            ...input.profile,
            contact: { ...baseProfile.contact, ...input.profile.contact },
          })
        : undefined;
    if (mergedProfile && card.ownerId) {
      await this.assertProfileImages(card.ownerId, cardId, mergedProfile);
    }
    const cardOwnerId = card.ownerId;
    if (input.products && cardOwnerId) {
      await Promise.all(
        input.products.map((product) =>
          this.uploads.assertCardImage(cardOwnerId, cardId, product.image, 'product'),
        ),
      );
    }
    const profileData = mergedProfile ? this.toProfileCreateData(mergedProfile) : undefined;
    const currentOffice = card.cardProfile?.office
      ? this.parseOffice(card.cardProfile.office)
      : { hasOffice: false };
    const officeData =
      input.office && baseProfile
        ? CardOfficeSchema.parse({ ...currentOffice, ...input.office })
        : undefined;

    const updated = await this.prisma.$transaction(async (transaction) => {
      let cardProfileId = card.cardProfile?.id;
      if (profileData || officeData || input.products) {
        if (!baseProfile) {
          throw new ConflictException('Card profile data could not be initialized.');
        }
        const profile = await transaction.cardProfile.upsert({
          where: { cardId },
          create: { cardId, ...(profileData ?? this.toProfileCreateData(baseProfile)) },
          update: profileData ?? {},
          select: { id: true },
        });
        cardProfileId = profile.id;
      }
      if (officeData && cardProfileId) {
        await transaction.cardOffice.upsert({
          where: { cardProfileId },
          create: { cardProfileId, ...officeData },
          update: officeData,
        });
      }
      if (input.products && cardProfileId) {
        await this.lockProductList(transaction, cardProfileId);
        const existingProducts = await transaction.cardProduct.findMany({
          where: { cardProfileId, deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        });
        for (const [index, product] of input.products.entries()) {
          const current = existingProducts[index];
          const data = {
            image: product.image,
            name: product.name,
            price: product.price ?? null,
            currency: product.currency,
            detail: product.detail,
            sortOrder: index,
          };
          if (current) {
            await transaction.cardProduct.update({ where: { id: current.id }, data });
          } else {
            await transaction.cardProduct.create({ data: { cardProfileId, ...data } });
          }
        }
        const removedProducts = existingProducts.slice(input.products.length);
        if (removedProducts.length) {
          await transaction.cardProduct.updateMany({
            where: { id: { in: removedProducts.map(({ id }) => id) }, cardProfileId },
            data: { deletedAt: new Date() },
          });
        }
      }
      if (input.card) {
        await transaction.card.update({
          where: { id: cardId },
          data: {
            slug: input.card.slug,
            purpose: PRISMA_CARD_PURPOSES[input.card.purpose],
            customPurpose: input.card.customPurpose ?? null,
          },
        });
      }
      await this.createAuditLog(transaction, actorId, cardId, 'card.updated', {
        fields: Object.keys(input),
      });
      return transaction.card.findUniqueOrThrow({
        where: { id: cardId },
        include: cardWorkspaceInclude,
      });
    });
    await this.invalidateCard(card.slug, updated.slug);
    return this.toCardResponse(updated);
  }

  async adminActivate(actorId: string, cardId: string) {
    return this.adminUpdateStatus(actorId, cardId, CardStatus.ACTIVE, 'card.activated');
  }

  async adminDeactivate(actorId: string, cardId: string) {
    return this.adminUpdateStatus(actorId, cardId, CardStatus.INACTIVE, 'card.deactivated');
  }

  async adminDelete(actorId: string, cardId: string) {
    return this.adminUpdateStatus(actorId, cardId, CardStatus.DELETED, 'card.deleted', new Date());
  }

  async adminRestore(actorId: string, cardId: string) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, slug: true, status: true },
    });
    if (!card || card.status !== CardStatus.DELETED) {
      throw new NotFoundException('Deleted card not found.');
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.card.update({
        where: { id: cardId },
        data: {
          status: CardStatus.INACTIVE,
          deletedAt: null,
          revokedAt: null,
        },
      });
      await this.createAuditLog(transaction, actorId, cardId, 'card.restored', {});
    });
    await this.invalidateCard(card.slug);
    return { id: cardId, status: CardStatus.INACTIVE };
  }

  async adminListUsers(input: AdminUserSearchInput) {
    const where: Prisma.UserWhereInput = {
      deletedAt: null,
      ...(input.query
        ? {
            OR: [
              { email: { contains: input.query, mode: 'insensitive' } },
              { name: { contains: input.query, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [total, users] = await this.prisma.$transaction([
      this.prisma.user.count({ where }),
      this.prisma.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          _count: {
            select: {
              cards: {
                where: { deletedAt: null, status: { not: CardStatus.DELETED } },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return {
      items: users.map(({ _count, ...user }) => ({ ...user, cardCount: _count.cards })),
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async adminListAuditLogs(input: AdminAuditSearchInput) {
    const [total, items] = await this.prisma.$transaction([
      this.prisma.auditLog.count(),
      this.prisma.auditLog.findMany({
        include: {
          actor: { select: { id: true, email: true, name: true } },
          card: { select: { id: true, slug: true } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
    ]);
    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async adminOverview() {
    const [users, cards, activeCards, inactiveCards, deletedCards, products] = await Promise.all([
      this.prisma.user.count({ where: { deletedAt: null } }),
      this.prisma.card.count({ where: { deletedAt: null, status: { not: CardStatus.DELETED } } }),
      this.prisma.card.count({ where: { deletedAt: null, status: CardStatus.ACTIVE } }),
      this.prisma.card.count({ where: { deletedAt: null, status: CardStatus.INACTIVE } }),
      this.prisma.card.count({ where: { status: CardStatus.DELETED } }),
      this.prisma.cardProduct.count({ where: { deletedAt: null } }),
    ]);
    return { users, cards, activeCards, inactiveCards, deletedCards, products };
  }

  async getPublicCard(slug: string) {
    const card = await this.prisma.card.findUnique({
      where: { slug },
      include: {
        owner: { select: { name: true, email: true } },
        cardProfile: {
          include: {
            office: true,
            products: {
              where: { deletedAt: null },
              orderBy: { sortOrder: 'asc' },
            },
          },
        },
      },
    });
    if (!card || card.deletedAt || card.status === CardStatus.DELETED) {
      throw new NotFoundException('Card not found.');
    }
    if (card.status !== CardStatus.ACTIVE) {
      if (card.status === CardStatus.INACTIVE) {
        return {
          status: 'inactive' as const,
          name: card.cardProfile?.fullName ?? card.owner?.name ?? card.owner?.email ?? 'Card',
        };
      }
      throw new NotFoundException('Card not found.');
    }
    const profile = card.cardProfile
      ? this.parseProfile(card.cardProfile)
      : await this.profileDefaultsWithAccount(card.ownerId ?? '', this.profileDefaults(card));
    const products =
      profile.showProducts && card.cardProfile
        ? card.cardProfile.products.map((product) => this.toProductResponse(product))
        : [];
    return {
      slug: card.slug,
      status: 'active' as const,
      profile,
      office:
        card.cardProfile?.office?.hasOffice === true
          ? this.parseOffice(card.cardProfile.office)
          : null,
      products,
    };
  }

  private async updateOwnedStatus(ownerId: string, cardId: string, status: CardStatus) {
    const card = await this.findOwnedCard(ownerId, cardId);
    if (card.status !== CardStatus.ACTIVE && card.status !== CardStatus.INACTIVE) {
      throw new ConflictException('Only active or inactive cards can be changed by their owner.');
    }
    const result = await this.prisma.card.updateMany({
      where: { id: cardId, ownerId, deletedAt: null, status: { not: CardStatus.DELETED } },
      data: {
        status,
        revokedAt: status === CardStatus.ACTIVE ? null : new Date(),
      },
    });
    if (!result.count) throw new NotFoundException('Card not found.');
    await this.invalidateCard(card.slug);
    return { id: cardId, status };
  }

  private async adminUpdateStatus(
    actorId: string,
    cardId: string,
    status: CardStatus,
    action: string,
    deletedAt?: Date,
  ) {
    const card = await this.prisma.card.findUnique({
      where: { id: cardId },
      select: { id: true, slug: true, status: true, deletedAt: true },
    });
    if (!card || card.deletedAt || card.status === CardStatus.DELETED) {
      throw new NotFoundException('Card not found.');
    }
    await this.prisma.$transaction(async (transaction) => {
      await transaction.card.update({
        where: { id: cardId },
        data: {
          status,
          deletedAt: status === CardStatus.DELETED ? (deletedAt ?? new Date()) : null,
          revokedAt: status === CardStatus.ACTIVE ? null : new Date(),
        },
      });
      await this.createAuditLog(transaction, actorId, cardId, action, { status });
    });
    await this.invalidateCard(card.slug);
    return { id: cardId, status };
  }

  private async findOwnedCard(ownerId: string, cardId: string): Promise<CardWithRelations> {
    const card = await this.prisma.card.findFirst({
      where: {
        id: cardId,
        ownerId,
        deletedAt: null,
        status: { not: CardStatus.DELETED },
      },
      include: cardWorkspaceInclude,
    });
    if (!card) throw new NotFoundException('Card not found.');
    return card;
  }

  private async requireCardProfile(card: CardWithRelations) {
    const profile = await this.prisma.cardProfile.findUnique({
      where: { cardId: card.id },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Card profile not found.');
    return profile;
  }

  private async getOrCreateProfile(card: CardWithRelations) {
    if (card.cardProfile) return { id: card.cardProfile.id };
    const values = await this.profileDefaultsWithAccount(
      card.ownerId ?? '',
      this.profileDefaults(card),
    );
    const data = this.toProfileCreateData(values);
    return this.prisma.cardProfile.upsert({
      where: { cardId: card.id },
      create: { cardId: card.id, ...data },
      update: {},
      select: { id: true },
    });
  }

  private profileDefaults(card: {
    owner: { name: string | null; email: string } | null;
  }): CardProfileData {
    return CardProfileDataSchema.parse({
      fullName: defaultFullName(card.owner?.name, card.owner?.email),
      contact: { email: card.owner?.email ?? null },
      socialLinks: [],
      themeColor: '#4f46e5',
      gallery: [],
      showProducts: false,
    });
  }

  private async profileDefaultsWithAccount(
    ownerId: string,
    fallback: CardProfileData,
  ): Promise<CardProfileData> {
    if (!ownerId) return fallback;
    const account = await this.prisma.user.findFirst({
      where: { id: ownerId, deletedAt: null },
      select: { name: true, email: true },
    });
    if (!account) return fallback;
    return CardProfileDataSchema.parse({
      ...fallback,
      fullName: defaultFullName(account.name, account.email),
      contact: { ...fallback.contact, email: account.email },
    });
  }

  private parseProfile(profile: NonNullable<CardWithRelations['cardProfile']>): CardProfileData {
    const contact = asRecord(profile.contact);
    const socialLinks = normalizeSocialLinks(profile.socialLinks);
    const templateId = ProfileTemplateSelectionSchema.safeParse(profile.templateId);
    if (!templateId.success) {
      this.logger.warn('Unknown saved profile template; falling back to Default.');
    }
    return CardProfileDataSchema.parse({
      fullName: profile.fullName,
      jobTitle: profile.jobTitle ?? undefined,
      skillsLine: profile.skillsLine ?? undefined,
      tagline: profile.tagline ?? undefined,
      avatar: profile.avatar,
      cover: profile.cover,
      contact: {
        phone: contact.phone ?? undefined,
        email: contact.email ?? undefined,
        location: contact.location ?? undefined,
        website: contact.website,
      },
      socialLinks,
      themeColor: profile.themeColor,
      templateId: templateId.success ? templateId.data : null,
      gallery: profile.gallery,
      showProducts: profile.showProducts,
    });
  }

  private parseOffice(
    office: NonNullable<NonNullable<CardWithRelations['cardProfile']>['office']>,
  ) {
    return CardOfficeSchema.parse({
      hasOffice: office.hasOffice,
      companyName: office.companyName ?? undefined,
      designation: office.designation ?? undefined,
      department: office.department ?? undefined,
      officeAddress: office.officeAddress ?? undefined,
      officePhone: office.officePhone ?? undefined,
      officeEmail: office.officeEmail ?? undefined,
      companyWebsite: office.companyWebsite,
      workingHours: office.workingHours ?? undefined,
    });
  }

  private toProfileCreateData(profile: CardProfileData) {
    return {
      fullName: profile.fullName,
      jobTitle: profile.jobTitle ?? null,
      skillsLine: profile.skillsLine ?? null,
      tagline: profile.tagline ?? null,
      avatar: profile.avatar ?? null,
      cover: profile.cover ?? null,
      contact: {
        phone: profile.contact.phone ?? null,
        email: profile.contact.email ?? null,
        location: profile.contact.location ?? null,
        website: profile.contact.website ?? null,
      } satisfies Prisma.InputJsonObject,
      socialLinks: profile.socialLinks satisfies Prisma.InputJsonArray,
      themeColor: profile.themeColor,
      templateId: profile.templateId,
      gallery: profile.gallery satisfies Prisma.InputJsonArray,
      showProducts: profile.showProducts,
    };
  }

  private async assertProfileImages(
    ownerId: string,
    cardId: string,
    profile: CardProfileData,
  ): Promise<void> {
    const images = [
      ...(profile.avatar ? [{ url: profile.avatar, kind: 'avatar' as const }] : []),
      ...(profile.cover ? [{ url: profile.cover, kind: 'cover' as const }] : []),
      ...profile.gallery.map((url) => ({ url, kind: 'gallery' as const })),
    ];
    await Promise.all(
      images.map(({ url, kind }) => this.uploads.assertCardImage(ownerId, cardId, url, kind)),
    );
  }

  private toCardResponse(card: CardWithRelations) {
    return {
      id: card.id,
      ownerId: card.ownerId,
      slug: card.slug,
      status: card.status,
      purpose: card.purpose,
      customPurpose: card.customPurpose,
      createdBy: card.createdBy,
      createdAt: card.createdAt,
      updatedAt: card.updatedAt,
      deletedAt: card.deletedAt,
      profile: card.cardProfile ? this.parseProfile(card.cardProfile) : this.profileDefaults(card),
      office: card.cardProfile?.office ? this.parseOffice(card.cardProfile.office) : null,
      products: card.cardProfile
        ? card.cardProfile.products.map((product) => this.toProductResponse(product))
        : [],
      owner: card.owner,
      hasSavedProfile: card.cardProfile !== null,
    };
  }

  private toProductResponse(product: DbCardProduct) {
    const price = product.price?.toNumber();
    return {
      id: product.id,
      image: product.image,
      name: product.name,
      ...(price === undefined ? {} : { price }),
      currency: product.currency,
      detail: product.detail,
      sortOrder: product.sortOrder,
    };
  }

  private async lockProductList(
    transaction: Prisma.TransactionClient,
    cardProfileId: string,
  ): Promise<void> {
    await transaction.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${cardProfileId}))`;
  }

  private async persistProductOrder(
    transaction: Prisma.TransactionClient,
    cardProfileId: string,
    productIds: string[],
  ): Promise<void> {
    for (const [sortOrder, id] of productIds.entries()) {
      await transaction.cardProduct.updateMany({
        where: { id, cardProfileId, deletedAt: null },
        data: { sortOrder },
      });
    }
  }

  private async createAuditLog(
    transaction: Prisma.TransactionClient,
    actorId: string,
    cardId: string,
    action: string,
    metadata: Prisma.InputJsonObject,
  ): Promise<void> {
    await transaction.auditLog.create({
      data: {
        actorId,
        cardId,
        action,
        entityType: 'card',
        entityId: cardId,
        metadata,
      },
    });
  }

  private async invalidateCard(...slugs: string[]): Promise<void> {
    await this.revalidation.revalidate([...new Set(slugs)]);
  }
}

function asRecord(value: Prisma.JsonValue): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {};
}

function defaultFullName(name: string | null | undefined, email: string | undefined): string {
  const accountName = name?.trim();
  return ((accountName && accountName.length >= 2 ? accountName : email) || 'Card owner').slice(
    0,
    100,
  );
}

function normalizeSocialLinks(value: Prisma.JsonValue) {
  if (!Array.isArray(value)) return [];
  const platforms: Record<string, string> = {
    website: 'WEBSITE',
    linkedin: 'LINKEDIN',
    github: 'GITHUB',
    instagram: 'INSTAGRAM',
    facebook: 'FACEBOOK',
    x: 'X',
    youtube: 'YOUTUBE',
    tiktok: 'TIKTOK',
  };
  return value.flatMap((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) return [];
    const platform =
      'platform' in item && typeof item.platform === 'string'
        ? platforms[item.platform.toLowerCase()]
        : undefined;
    const url = 'url' in item && typeof item.url === 'string' ? item.url : undefined;
    return platform && url ? [{ platform, url }] : [];
  });
}
