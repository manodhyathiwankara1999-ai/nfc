import { CardStatus } from '@prisma/client';
import { NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';
import { CardUploadsService } from './card-uploads.service';
import { CardWorkspaceService } from './card-workspace.service';

const cardId = 'c1074dc6-df59-4e7d-b138-4b9ab046ad6d';
const ownerId = 'fbde5b86-4934-4c31-a03f-b6fcfa62c8e0';

function makeCard(overrides: Record<string, unknown> = {}) {
  return {
    id: cardId,
    ownerId,
    slug: 'ada-lovelace',
    purpose: 'PERSONAL',
    customPurpose: null,
    status: CardStatus.ACTIVE,
    createdBy: 'OWNER',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    revokedAt: null,
    claimCodeHash: null,
    label: null,
    owner: { id: ownerId, name: 'Ada Lovelace', email: 'ada@example.com' },
    cardProfile: null,
    ...overrides,
  };
}

function makeProfile(products: unknown[] = []) {
  return {
    id: '00e3f63b-f18d-4c9d-bc62-ddf6d6c42e81',
    cardId,
    fullName: 'Ada Lovelace',
    jobTitle: null,
    skillsLine: null,
    tagline: null,
    avatar: null,
    cover: null,
    contact: {
      phone: null,
      email: 'ada@example.com',
      location: null,
      website: null,
    },
    socialLinks: [],
    themeColor: '#4f46e5',
    templateId: null,
    gallery: [],
    showProducts: true,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    office: null,
    products,
  };
}

function setup(card = makeCard(), findUniqueCard = card) {
  const transaction = {
    card: { update: vi.fn().mockResolvedValue(undefined) },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
  const prisma = {
    card: {
      findFirst: vi.fn().mockResolvedValue(card),
      findUnique: vi.fn().mockResolvedValue(findUniqueCard),
    },
    user: {
      findFirst: vi.fn().mockResolvedValue({ name: 'Ada Lovelace', email: 'ada@example.com' }),
    },
    cardProfile: { upsert: vi.fn().mockResolvedValue({ id: makeProfile().id }) },
    $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  };
  const revalidation = { revalidate: vi.fn().mockResolvedValue(undefined) };
  const uploads = { assertCardImage: vi.fn().mockResolvedValue(undefined) };
  const service = new CardWorkspaceService(
    prisma as unknown as PrismaService,
    { get: vi.fn().mockReturnValue(5) } as never,
    revalidation as unknown as WebRevalidationService,
    uploads as unknown as CardUploadsService,
  );
  return { service, prisma, revalidation, transaction };
}

describe('CardWorkspaceService', () => {
  it('creates super-admin cards as active and records the creation', async () => {
    const actorId = 'c2ab6a57-922a-4358-98f2-a49f650fda1a';
    const createdCard = makeCard({ status: CardStatus.ACTIVE, createdBy: 'SUPER_ADMIN' });
    const transaction = {
      $executeRaw: vi.fn(),
      card: {
        count: vi.fn().mockResolvedValue(0),
        create: vi.fn().mockResolvedValue(createdCard),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue({ id: ownerId }) },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new CardWorkspaceService(
      prisma as unknown as PrismaService,
      { get: vi.fn().mockReturnValue(5) } as never,
      { revalidate: vi.fn().mockResolvedValue(undefined) } as unknown as WebRevalidationService,
      { assertCardImage: vi.fn().mockResolvedValue(undefined) } as unknown as CardUploadsService,
    );

    await service.adminCreateCard(actorId, {
      ownerEmail: 'ada@example.com',
      purpose: 'PERSONAL',
    });

    expect(transaction.card.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: CardStatus.ACTIVE, createdBy: 'SUPER_ADMIN' }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actorId, action: 'card.created' }),
      }),
    );
  });

  it('scopes card reads to the authenticated owner', async () => {
    const { service, prisma } = setup();
    prisma.card.findFirst.mockResolvedValue(null);

    await expect(service.getMine(ownerId, cardId)).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: cardId, ownerId }),
      }),
    );
  });

  it('prefills an unsaved card profile from the account', async () => {
    const { service } = setup();

    await expect(service.getMine(ownerId, cardId)).resolves.toMatchObject({
      hasSavedProfile: false,
      profile: {
        fullName: 'Ada Lovelace',
        contact: { email: 'ada@example.com' },
      },
    });
  });

  it('persists account defaults and independent profile values on the first save', async () => {
    const { service, prisma } = setup();

    await service.updateProfile(ownerId, cardId, { fullName: 'Independent Name' });

    expect(prisma.cardProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { cardId },
        create: expect.objectContaining({
          cardId,
          fullName: 'Independent Name',
          contact: expect.objectContaining({ email: 'ada@example.com' }),
        }),
      }),
    );
  });

  it('saves and returns the selected template per card profile', async () => {
    const { service, prisma } = setup();
    prisma.card.findFirst.mockResolvedValue(
      makeCard({ cardProfile: { ...makeProfile(), templateId: 'editorial' } }),
    );

    await service.updateProfile(ownerId, cardId, { templateId: 'editorial' });

    expect(prisma.cardProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ templateId: 'editorial' }),
        update: expect.objectContaining({ templateId: 'editorial' }),
      }),
    );
  });

  it('falls back to Default for an unknown legacy template id', async () => {
    const { service } = setup(
      makeCard({
        cardProfile: { ...makeProfile(), templateId: 'legacy-template' },
      }),
    );

    await expect(service.getMine(ownerId, cardId)).resolves.toMatchObject({
      profile: { templateId: null },
    });
  });

  it('does not return a product price when the product has no price', async () => {
    const product = {
      id: '0b2aa8a6-066f-466a-9264-85c5630fe182',
      cardProfileId: makeProfile().id,
      image: 'https://cdn.example.com/product.png',
      name: 'Engine',
      price: null,
      currency: 'USD',
      detail: 'A precision engine.',
      sortOrder: 0,
      deletedAt: null,
    };
    const { service } = setup(makeCard({ cardProfile: makeProfile([product]) }));

    const result = await service.getMine(ownerId, cardId);

    expect(result.products).toEqual([
      expect.objectContaining({ id: product.id, name: 'Engine', currency: 'USD' }),
    ]);
    expect(result.products[0]).not.toHaveProperty('price');
  });

  it('records an audit log for each super-admin status write', async () => {
    const actorId = 'c2ab6a57-922a-4358-98f2-a49f650fda1a';
    const { service, transaction } = setup();

    await service.adminDeactivate(actorId, cardId);

    expect(transaction.card.update).toHaveBeenCalled();
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId,
          cardId,
          action: 'card.deactivated',
        }),
      }),
    );
  });

  it('returns minimal data for inactive cards and hides deleted cards', async () => {
    const active = setup(makeCard({ cardProfile: makeProfile() }));
    await expect(active.service.getPublicCard('ada-lovelace')).resolves.toMatchObject({
      slug: 'ada-lovelace',
      status: 'active',
      profile: {
        fullName: 'Ada Lovelace',
        contact: { email: 'ada@example.com' },
      },
    });

    const inactive = setup(makeCard({ status: CardStatus.INACTIVE }));
    await expect(inactive.service.getPublicCard('ada-lovelace')).resolves.toEqual({
      status: 'inactive',
      name: 'Ada Lovelace',
    });

    const deleted = setup(makeCard({ status: CardStatus.DELETED }));
    await expect(deleted.service.getPublicCard('ada-lovelace')).rejects.toBeInstanceOf(
      NotFoundException,
    );

    const unknown = setup(makeCard(), null);
    await expect(unknown.service.getPublicCard('unknown-card')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
