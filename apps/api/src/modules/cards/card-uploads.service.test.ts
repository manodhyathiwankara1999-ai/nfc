import { BadRequestException, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { CardUploadsService } from './card-uploads.service';
import { CardUploadPresignSchema } from './cards.schemas';

const ownerId = 'fbde5b86-4934-4c31-a03f-b6fcfa62c8e0';
const cardId = 'c1074dc6-df59-4e7d-b138-4b9ab046ad6d';

function setup() {
  const prisma = {
    card: { findFirst: vi.fn().mockResolvedValue({ id: cardId }) },
  };
  const config = {
    get: vi.fn((key: string) => {
      if (key === 'R2_BUCKET_NAME') return 'test-bucket';
      if (key === 'R2_PUBLIC_BASE_URL') return 'https://cdn.example.com';
      if (key === 'REVALIDATION_SECRET') return 'a'.repeat(32);
      return '';
    }),
  };
  return {
    service: new CardUploadsService(prisma as unknown as PrismaService, config as never),
    prisma,
  };
}

describe('CardUploadsService', () => {
  it('accepts only supported image content types', () => {
    for (const contentType of ['image/jpeg', 'image/png', 'image/webp']) {
      expect(
        CardUploadPresignSchema.safeParse({
          kind: 'AVATAR',
          contentType,
          size: 1024,
        }).success,
      ).toBe(true);
    }
    expect(
      CardUploadPresignSchema.safeParse({
        kind: 'AVATAR',
        contentType: 'image/gif',
        size: 1024,
      }).success,
    ).toBe(false);
  });

  it.each([
    ['AVATAR', 2 * 1024 * 1024],
    ['COVER', 5 * 1024 * 1024],
    ['GALLERY', 5 * 1024 * 1024],
    ['PRODUCT', 3 * 1024 * 1024],
  ] as const)('rejects %s uploads larger than their limit', async (kind, maxBytes) => {
    const { service } = setup();

    await expect(
      service.presign(ownerId, cardId, {
        kind,
        contentType: 'image/png',
        size: maxBytes + 1,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('checks ownership before issuing an upload URL', async () => {
    const { service, prisma } = setup();
    prisma.card.findFirst.mockResolvedValue(null);

    await expect(
      service.presign(ownerId, cardId, {
        kind: 'AVATAR',
        contentType: 'image/jpeg',
        size: 1024,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.card.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: cardId, ownerId }),
      }),
    );
  });

  it('returns a typed storage error when R2 is not configured', async () => {
    const { service } = setup();

    try {
      await service.presign(ownerId, cardId, {
        kind: 'PRODUCT',
        contentType: 'image/png',
        size: 1024,
      });
      throw new Error('Expected presign to reject when storage is not configured.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      if (!(error instanceof HttpException)) throw error;
      expect(error.getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      expect(error.getResponse()).toEqual({
        code: 'STORAGE_NOT_CONFIGURED',
        message: 'Image storage is not configured. Please contact support.',
      });
    }
  });
});
