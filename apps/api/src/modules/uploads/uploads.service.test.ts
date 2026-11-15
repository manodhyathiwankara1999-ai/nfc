import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';
import { matchesImageType, UploadsService } from './uploads.service';

describe('matchesImageType', () => {
  it('accepts only matching JPEG, PNG, and WebP magic bytes', () => {
    expect(matchesImageType(Buffer.from([0xff, 0xd8, 0xff, 0x00]), 'image/jpeg')).toBe(true);
    expect(matchesImageType(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'image/png')).toBe(
      true,
    );
    expect(matchesImageType(Buffer.from('RIFFxxxxWEBP'), 'image/webp')).toBe(true);
    expect(matchesImageType(Buffer.from('<svg/>'), 'image/png')).toBe(false);
    expect(matchesImageType(Buffer.from([0xff, 0xd8, 0xff]), 'image/png')).toBe(false);
  });

  describe('UploadsService', () => {
    const config = {
      get: (key: string) =>
        ({
          R2_ACCOUNT_ID: 'account',
          R2_BUCKET_NAME: 'bucket',
          R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
          GALLERY_MAX_IMAGES: 30,
          R2_ACCESS_KEY_ID: 'access',
          R2_SECRET_ACCESS_KEY: 'secret',
        })[key],
    };

    it('rejects oversize images before creating an asset or contacting R2', async () => {
      const profileLookup = vi.fn();
      const service = new UploadsService(
        { profile: { findUnique: profileLookup } } as unknown as PrismaService,
        {} as WebRevalidationService,
        config as never,
      );

      await expect(
        service.presign('owner-id', {
          kind: 'AVATAR',
          contentType: 'image/png',
          size: 2 * 1024 * 1024 + 1,
        }),
      ).rejects.toThrow('File exceeds the 2 MB limit.');
      expect(profileLookup).not.toHaveBeenCalled();
      service.onModuleDestroy();
    });

    it('refuses uploads when the session owner has no profile', async () => {
      const createAsset = vi.fn();
      const service = new UploadsService(
        {
          profile: { findUnique: vi.fn().mockResolvedValue(null) },
          asset: { create: createAsset },
        } as unknown as PrismaService,
        {} as WebRevalidationService,
        config as never,
      );

      await expect(
        service.presign('owner-id', { kind: 'AVATAR', contentType: 'image/png', size: 1024 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(createAsset).not.toHaveBeenCalled();
      service.onModuleDestroy();
    });

    it('reports unavailable storage when R2 is not configured', async () => {
      const profileLookup = vi.fn();
      const service = new UploadsService(
        { profile: { findUnique: profileLookup } } as unknown as PrismaService,
        {} as WebRevalidationService,
        { get: () => '' } as never,
      );

      await expect(
        service.presign('owner-id', { kind: 'AVATAR', contentType: 'image/png', size: 1024 }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(profileLookup).not.toHaveBeenCalled();
      service.onModuleDestroy();
    });

    it('creates the random object key and asset from the authenticated owner', async () => {
      const profileId = '64ba5ef8-b67c-4bfe-8a3c-a3c87dbf0a6a';
      const createAsset = vi.fn().mockResolvedValue({ id: 'ad8b49de-100f-4013-9e68-75be77ca6b11' });
      const service = new UploadsService(
        {
          profile: { findUnique: vi.fn().mockResolvedValue({ id: profileId }) },
          asset: { create: createAsset },
        } as unknown as PrismaService,
        {} as WebRevalidationService,
        config as never,
      );

      const result = await service.presign('authenticated-owner', {
        kind: 'AVATAR',
        contentType: 'image/webp',
        size: 1024,
      });
      const data = createAsset.mock.calls[0]?.[0].data as {
        userId: string;
        profileId: string;
        objectKey: string;
      };
      expect(data).toMatchObject({ userId: 'authenticated-owner', profileId });
      expect(data.objectKey).toMatch(/^users\/authenticated-owner\/avatar\/[0-9a-f-]+\.webp$/);
      expect(result).toMatchObject({
        assetId: 'ad8b49de-100f-4013-9e68-75be77ca6b11',
        expiresIn: 300,
      });
      expect(result.uploadUrl).toContain('r2.cloudflarestorage.com');
      service.onModuleDestroy();
    });
  });
});
