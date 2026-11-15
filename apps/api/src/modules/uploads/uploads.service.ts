import {
  BadRequestException,
  ConflictException,
  Injectable,
  OnModuleDestroy,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ApiEnvironment } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { WebRevalidationService } from '../../common/utils/web-revalidation.service';
import { PROFILE_IMAGE_LIMITS } from '@nfc/shared';

const EXTENSIONS = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' } as const;
const SocialPlatformSchema = z.enum([
  'website',
  'linkedin',
  'instagram',
  'x',
  'facebook',
  'youtube',
  'tiktok',
  'github',
]);
type SocialPlatform = z.infer<typeof SocialPlatformSchema>;
const LIMITS = {
  AVATAR: PROFILE_IMAGE_LIMITS.AVATAR / (1024 * 1024),
  COVER: PROFILE_IMAGE_LIMITS.COVER / (1024 * 1024),
  GALLERY: PROFILE_IMAGE_LIMITS.GALLERY / (1024 * 1024),
  LOGO: 5,
} as const;
type UploadKind = keyof typeof LIMITS;
type UploadInput = { kind: UploadKind; contentType: keyof typeof EXTENSIONS; size: number };

@Injectable()
export class UploadsService implements OnModuleDestroy {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly galleryMax: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly revalidation: WebRevalidationService,
    config: ConfigService<ApiEnvironment, true>,
  ) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    this.bucket = config.get('R2_BUCKET_NAME', { infer: true });
    this.publicBaseUrl = config.get('R2_PUBLIC_BASE_URL', { infer: true }).replace(/\/+$/, '');
    this.galleryMax = config.get('GALLERY_MAX_IMAGES', { infer: true });
    this.s3 = accountId
      ? new S3Client({
          region: 'auto',
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: {
            accessKeyId: config.get('R2_ACCESS_KEY_ID', { infer: true }),
            secretAccessKey: config.get('R2_SECRET_ACCESS_KEY', { infer: true }),
          },
        })
      : null;
  }

  async presign(userId: string, input: UploadInput) {
    const s3 = this.getS3();
    const maxBytes = LIMITS[input.kind] * 1024 * 1024;
    if (input.size > maxBytes)
      throw new BadRequestException(`File exceeds the ${LIMITS[input.kind]} MB limit.`);
    if (input.kind === 'GALLERY') await this.assertGalleryQuota(userId);

    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Profile not found.');
    const objectKey = `users/${userId}/${input.kind.toLowerCase()}/${randomUUID()}.${EXTENSIONS[input.contentType]}`;
    const asset = await this.prisma.asset.create({
      data: {
        userId,
        profileId: profile.id,
        kind: input.kind,
        objectKey,
        contentType: input.contentType,
        size: input.size,
      },
      select: { id: true },
    });
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.contentType,
      }),
      { expiresIn: 300 },
    );
    return {
      assetId: asset.id,
      uploadUrl,
      expiresIn: 300,
      headers: { 'Content-Type': input.contentType },
    };
  }

  async confirm(userId: string, assetId: string) {
    const s3 = this.getS3();
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, userId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Upload not found.');
    if (asset.confirmedAt) return { assetId: asset.id, url: this.publicUrl(asset.objectKey) };

    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: asset.objectKey }));
    } catch (error) {
      throw new BadRequestException('Uploaded object does not exist or could not be verified.', {
        cause: error,
      });
    }
    if (head.ContentLength !== asset.size || head.ContentType !== asset.contentType) {
      throw new BadRequestException(
        'Uploaded file size or content type does not match the presigned request.',
      );
    }
    if (asset.size > limitMegabytes(asset.kind) * 1024 * 1024) {
      throw new BadRequestException('Uploaded file exceeds the allowed size.');
    }
    const body = await s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: asset.objectKey,
        Range: 'bytes=0-11',
      }),
    );
    const headerBytes = body.Body
      ? Buffer.from(await body.Body.transformToByteArray())
      : Buffer.alloc(0);
    if (!matchesImageType(headerBytes, asset.contentType)) {
      throw new BadRequestException(
        'Uploaded file content does not match its declared image type.',
      );
    }
    const url = this.publicUrl(asset.objectKey);
    const previousAssets =
      asset.kind === 'AVATAR' || asset.kind === 'COVER'
        ? await this.prisma.asset.findMany({
            where: {
              profileId: asset.profileId,
              kind: asset.kind,
              confirmedAt: { not: null },
              deletedAt: null,
              id: { not: asset.id },
            },
            select: { id: true, objectKey: true },
          })
        : [];

    await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.asset.updateMany({
        where: { id: asset.id, confirmedAt: null, deletedAt: null },
        data: { confirmedAt: new Date() },
      });
      if (updated.count === 0) return;
      if (!asset.profileId) throw new BadRequestException('Upload is not linked to a profile.');
      if (asset.kind === 'AVATAR') {
        await transaction.profile.update({
          where: { id: asset.profileId },
          data: { avatarUrl: url },
        });
      } else if (asset.kind === 'GALLERY') {
        const count = await transaction.galleryImage.count({
          where: { profileId: asset.profileId, deletedAt: null },
        });
        if (count >= this.galleryMax) throw new ConflictException('Gallery image quota reached.');
        await transaction.galleryImage.create({
          data: {
            profileId: asset.profileId,
            assetId: asset.id,
            objectKey: asset.objectKey,
            position: count,
          },
        });
      } else if (asset.kind === 'COVER') {
        await transaction.profile.update({
          where: { id: asset.profileId },
          data: { coverImageUrl: url },
        });
      }
    });
    for (const previous of previousAssets) {
      await s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: previous.objectKey }));
      await this.prisma.asset.update({
        where: { id: previous.id },
        data: { deletedAt: new Date() },
      });
    }
    await this.invalidateProfile(asset.profileId);
    return { assetId: asset.id, url };
  }

  async deleteAsset(userId: string, assetId: string) {
    const s3 = this.getS3();
    const asset = await this.prisma.asset.findFirst({
      where: { id: assetId, userId, deletedAt: null },
    });
    if (!asset) throw new NotFoundException('Asset not found.');
    await s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: asset.objectKey }));
    await this.prisma.$transaction(async (transaction) => {
      if (asset.kind === 'AVATAR' && asset.profileId) {
        await transaction.profile.updateMany({
          where: { id: asset.profileId, avatarUrl: this.publicUrl(asset.objectKey) },
          data: { avatarUrl: null },
        });
      }
      await transaction.galleryImage.deleteMany({ where: { assetId: asset.id } });
      if (asset.profileId) {
        if (asset.kind === 'COVER') {
          await transaction.profile.updateMany({
            where: { id: asset.profileId, coverImageUrl: this.publicUrl(asset.objectKey) },
            data: { coverImageUrl: null },
          });
        }
      }
      await transaction.asset.update({ where: { id: asset.id }, data: { deletedAt: new Date() } });
    });
    await this.invalidateProfile(asset.profileId);
    return { deleted: true };
  }

  async deleteCurrent(userId: string, kind: UploadKind) {
    const profile = await this.getProfile(userId);
    const asset = await this.prisma.asset.findFirst({
      where: { userId, profileId: profile.id, kind, confirmedAt: { not: null }, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (!asset) return { deleted: false };
    return this.deleteAsset(userId, asset.id);
  }

  async getGallery(userId: string) {
    const profile = await this.getProfile(userId);
    const rows = await this.prisma.galleryImage.findMany({
      where: { profileId: profile.id, deletedAt: null },
      orderBy: { position: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      url: this.publicUrl(row.objectKey),
      altText: row.altText,
      caption: row.caption,
      position: row.position,
    }));
  }

  async updateGallery(
    userId: string,
    imageId: string,
    patch: {
      caption?: string | null;
      altText?: string | null;
      position?: number;
    },
  ) {
    const profile = await this.getProfile(userId);
    const result = await this.prisma.galleryImage.updateMany({
      where: { id: imageId, profileId: profile.id, deletedAt: null },
      data: patch,
    });
    if (!result.count) throw new NotFoundException('Gallery image not found.');
    await this.invalidateProfile(profile.id);
    return this.getGallery(userId);
  }

  async deleteGallery(userId: string, imageId: string) {
    const profile = await this.getProfile(userId);
    const image = await this.prisma.galleryImage.findFirst({
      where: { id: imageId, profileId: profile.id, deletedAt: null },
      select: { assetId: true },
    });
    if (!image) throw new NotFoundException('Gallery image not found.');
    if (image.assetId) return this.deleteAsset(userId, image.assetId);
    await this.prisma.galleryImage.update({
      where: { id: imageId },
      data: { deletedAt: new Date() },
    });
    await this.invalidateProfile(profile.id);
    return { deleted: true };
  }

  async getSocialLinks(userId: string) {
    const profile = await this.getProfile(userId);
    return this.prisma.socialLink.findMany({
      where: { profileId: profile.id },
      orderBy: { position: 'asc' },
      select: { id: true, platform: true, label: true, url: true, position: true },
    });
  }

  async createSocialLink(userId: string, input: SocialInput) {
    const profile = await this.getProfile(userId);
    const normalized = this.normalizeSocialUrl(input.platform, input.url);
    await this.prisma.socialLink.create({
      data: {
        profileId: profile.id,
        platform: input.platform,
        label: input.label,
        url: normalized,
        position: input.position ?? 0,
      },
    });
    await this.invalidateProfile(profile.id);
    return this.getSocialLinks(userId);
  }

  async replaceSocialLinks(userId: string, inputs: SocialInput[]) {
    const profile = await this.getProfile(userId);
    const rows = inputs.map((input, position) => ({
      platform: input.platform,
      label: input.label,
      url: this.normalizeSocialUrl(input.platform, input.url),
      position: input.position ?? position,
    }));
    await this.prisma.$transaction(async (transaction) => {
      await transaction.socialLink.deleteMany({ where: { profileId: profile.id } });
      if (rows.length) {
        await transaction.socialLink.createMany({
          data: rows.map((row) => ({ ...row, profileId: profile.id })),
        });
      }
    });
    await this.invalidateProfile(profile.id);
    return this.getSocialLinks(userId);
  }

  async updateSocialLink(userId: string, linkId: string, patch: Partial<SocialInput>) {
    const profile = await this.getProfile(userId);
    const found = await this.prisma.socialLink.findFirst({
      where: { id: linkId, profileId: profile.id },
    });
    if (!found) throw new NotFoundException('Social link not found.');
    const platform = patch.platform ?? SocialPlatformSchema.parse(found.platform);
    await this.prisma.socialLink.update({
      where: { id: linkId },
      data: {
        ...(patch.platform ? { platform: patch.platform } : {}),
        ...(patch.label !== undefined ? { label: patch.label } : {}),
        ...(patch.position !== undefined ? { position: patch.position } : {}),
        ...(patch.url ? { url: this.normalizeSocialUrl(platform, patch.url) } : {}),
      },
    });
    await this.invalidateProfile(profile.id);
    return this.getSocialLinks(userId);
  }

  async deleteSocialLink(userId: string, linkId: string) {
    const profile = await this.getProfile(userId);
    const result = await this.prisma.socialLink.deleteMany({
      where: { id: linkId, profileId: profile.id },
    });
    if (!result.count) throw new NotFoundException('Social link not found.');
    await this.invalidateProfile(profile.id);
    return this.getSocialLinks(userId);
  }

  private normalizeSocialUrl(platform: string, value: string): string {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Social link URL is invalid.');
    }
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) {
      throw new BadRequestException('Social link URL must be a safe HTTP(S) URL.');
    }
    const hosts: Record<string, string[]> = {
      linkedin: ['linkedin.com', 'www.linkedin.com'],
      instagram: ['instagram.com', 'www.instagram.com'],
      x: ['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com'],
      facebook: ['facebook.com', 'www.facebook.com'],
      youtube: ['youtube.com', 'www.youtube.com', 'youtu.be'],
      tiktok: ['tiktok.com', 'www.tiktok.com'],
      github: ['github.com', 'www.github.com'],
    };
    const allowed = hosts[platform];
    if (allowed && !allowed.includes(url.hostname.toLowerCase())) {
      throw new BadRequestException(`URL host does not match the ${platform} platform.`);
    }
    url.hash = '';
    return url.toString();
  }

  private async assertGalleryQuota(userId: string) {
    const profile = await this.getProfile(userId);
    const count = await this.prisma.galleryImage.count({
      where: { profileId: profile.id, deletedAt: null },
    });
    if (count >= this.galleryMax) throw new ConflictException('Gallery image quota reached.');
  }

  private async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!profile) throw new NotFoundException('Profile not found.');
    return profile;
  }

  private async invalidateProfile(profileId: string | null) {
    if (!profileId) return;
    const [profile, cards] = await Promise.all([
      this.prisma.profile.findUnique({ where: { id: profileId }, select: { slug: true } }),
      this.prisma.card.findMany({ where: { profileId }, select: { slug: true } }),
    ]);
    const slugs = [
      ...new Set(
        [profile?.slug, ...cards.map((card) => card.slug)].filter((slug): slug is string =>
          Boolean(slug),
        ),
      ),
    ];
    await this.revalidation.revalidate(slugs);
  }

  private publicUrl(key: string) {
    if (!this.publicBaseUrl)
      throw new ServiceUnavailableException('R2_PUBLIC_BASE_URL is required for public assets.');
    return `${this.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`;
  }

  private getS3(): S3Client {
    if (!this.s3) throw new ServiceUnavailableException('Image storage is not configured.');
    return this.s3;
  }

  onModuleDestroy(): void {
    this.s3?.destroy();
  }
}

function limitMegabytes(kind: string): number {
  switch (kind) {
    case 'AVATAR':
      return LIMITS.AVATAR;
    case 'COVER':
      return LIMITS.COVER;
    case 'GALLERY':
      return LIMITS.GALLERY;
    case 'LOGO':
      return LIMITS.LOGO;
    default:
      throw new BadRequestException('Upload kind is invalid.');
  }
}

export function matchesImageType(bytes: Buffer, contentType: string): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    );
  }
  if (contentType === 'image/webp') {
    return (
      bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP'
    );
  }
  return false;
}

type SocialInput = {
  platform: SocialPlatform;
  label: string;
  url: string;
  position?: number;
};
