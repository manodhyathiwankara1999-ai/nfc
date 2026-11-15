import { CardCreator, CardStatus } from '@prisma/client';
import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';
import { CardsService } from './cards.service';

describe('CardsService', () => {
  it('creates an inactive card with an opaque URL-safe slug and only returns the claim code once', async () => {
    const cardCreate = vi.fn(
      async (args: { data: { slug: string; label?: string; status: CardStatus } }) => ({
        slug: args.data.slug,
        label: args.data.label,
        status: args.data.status,
        createdAt: new Date('2026-10-07T00:00:00Z'),
      }),
    );
    const transaction = {
      card: { create: cardCreate },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = {
      profile: { findUnique: vi.fn().mockResolvedValue(null) },
      profileSlugRedirect: { findUnique: vi.fn().mockResolvedValue(null) },
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const revalidation = { revalidate: vi.fn().mockResolvedValue(undefined) };
    const cards = new CardsService(
      prisma as unknown as PrismaService,
      revalidation as unknown as WebRevalidationService,
    );

    const result = await cards.create('admin-id', 'Welcome card');
    const persisted = cardCreate.mock.calls[0]?.[0].data as {
      slug: string;
      claimCodeHash: string;
      status: CardStatus;
      createdBy: CardCreator;
    };

    expect(result.slug).toMatch(/^[A-Za-z0-9_-]{12,}$/);
    expect(result.status).toBe('inactive');
    expect(result.claimCode).toHaveLength(43);
    expect(persisted.slug).not.toBe('some-db-id');
    expect(persisted.claimCodeHash).toBe(
      createHash('sha256').update(result.claimCode).digest('hex'),
    );
    expect(persisted.claimCodeHash).not.toBe(result.claimCode);
    expect(persisted.createdBy).toBe(CardCreator.SUPER_ADMIN);
  });

  it('claims an inactive card for the profile derived from the authenticated user', async () => {
    const tx = {
      profile: { findUnique: vi.fn().mockResolvedValue({ id: 'owner-profile-id' }) },
      card: {
        findUnique: vi.fn().mockResolvedValue({
          id: 'private-card-id',
          slug: 'Opaque_slug-12345678901',
          label: 'Card',
          status: CardStatus.INACTIVE,
          profileId: null,
          deletedAt: null,
        }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      auditLog: { create: vi.fn().mockResolvedValue(undefined) },
    };
    const prisma = { $transaction: vi.fn((callback) => callback(tx)) };
    const revalidation = { revalidate: vi.fn().mockResolvedValue(undefined) };
    const cards = new CardsService(
      prisma as unknown as PrismaService,
      revalidation as unknown as WebRevalidationService,
    );

    const result = await cards.claim('authenticated-user-id', 'a'.repeat(43));

    expect(tx.profile.findUnique).toHaveBeenCalledWith({
      where: { userId: 'authenticated-user-id' },
      select: { id: true },
    });
    expect(tx.card.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ profileId: null, status: CardStatus.INACTIVE }),
        data: expect.objectContaining({ profileId: 'owner-profile-id', status: CardStatus.ACTIVE }),
      }),
    );
    expect(result).toEqual({
      slug: 'Opaque_slug-12345678901',
      label: 'Card',
      status: 'active',
    });
    expect(result).not.toHaveProperty('id');
  });
});
