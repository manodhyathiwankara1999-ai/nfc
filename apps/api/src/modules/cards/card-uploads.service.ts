import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleDestroy,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { CardStatus } from '@prisma/client';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import type { ApiEnvironment } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import type { z } from 'zod';
import type { CardUploadPresignSchema } from './cards.schemas';

type UploadKind = z.infer<typeof CardUploadPresignSchema>['kind'];
type ImageField = 'avatar' | 'cover' | 'gallery' | 'product';
type ImageContentType = 'image/jpeg' | 'image/png' | 'image/webp';

const FILE_EXTENSION: Record<ImageContentType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

const MAX_FILE_BYTES: Record<UploadKind, number> = {
  AVATAR: 2 * 1024 * 1024,
  COVER: 5 * 1024 * 1024,
  GALLERY: 5 * 1024 * 1024,
  PRODUCT: 3 * 1024 * 1024,
};

interface UploadTokenPayload {
  ownerId: string;
  cardId: string;
  objectKey: string;
  contentType: ImageContentType;
  size: number;
  expiresAt: number;
}

@Injectable()
export class CardUploadsService implements OnModuleDestroy {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly signatureSecret: string;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService<ApiEnvironment, true>,
  ) {
    const accountId = config.get('R2_ACCOUNT_ID', { infer: true });
    this.bucket = config.get('R2_BUCKET_NAME', { infer: true });
    this.publicBaseUrl = config.get('R2_PUBLIC_BASE_URL', { infer: true }).replace(/\/+$/, '');
    this.signatureSecret = config.get('REVALIDATION_SECRET', { infer: true });
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

  async presign(
    ownerId: string,
    cardId: string,
    input: { kind: UploadKind; contentType: ImageContentType; size: number },
  ) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const maxBytes = MAX_FILE_BYTES[input.kind];
    if (input.size > maxBytes) {
      throw new BadRequestException(
        `File exceeds the ${maxBytes / (1024 * 1024)} MB ${input.kind.toLowerCase()} limit.`,
      );
    }

    const s3 = this.getS3();
    const objectKey =
      `cards/${ownerId}/${card.id}/${input.kind.toLowerCase()}/${randomUUID()}.` +
      FILE_EXTENSION[input.contentType];
    const expiresIn = 300;
    const uploadUrl = await getSignedUrl(
      s3,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ContentType: input.contentType,
      }),
      { expiresIn },
    );
    const token = this.createToken({
      ownerId,
      cardId,
      objectKey,
      contentType: input.contentType,
      size: input.size,
      expiresAt: Date.now() + expiresIn * 1000,
    });

    return {
      uploadUrl,
      objectKey,
      publicUrl: this.publicUrl(objectKey),
      expiresIn,
      token,
      headers: { 'Content-Type': input.contentType },
    };
  }

  async confirm(
    ownerId: string,
    cardId: string,
    input: {
      objectKey: string;
      contentType: ImageContentType;
      size: number;
      token: string;
    },
  ) {
    const card = await this.findOwnedCard(ownerId, cardId);
    const token = this.verifyToken(input.token);
    if (
      token.ownerId !== ownerId ||
      token.cardId !== card.id ||
      token.objectKey !== input.objectKey ||
      token.contentType !== input.contentType ||
      token.size !== input.size ||
      token.expiresAt < Date.now()
    ) {
      throw new BadRequestException('Upload confirmation is invalid or expired.');
    }

    const objectKind = input.objectKey.split('/')[3]?.toUpperCase();
    if (!isUploadKind(objectKind) || input.size > MAX_FILE_BYTES[objectKind]) {
      throw new BadRequestException('Uploaded file exceeds the allowed size.');
    }
    if (!input.objectKey.startsWith(`cards/${ownerId}/${card.id}/${objectKind.toLowerCase()}/`)) {
      throw new BadRequestException('Upload does not belong to this card.');
    }

    const s3 = this.getS3();
    let head;
    try {
      head = await s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: input.objectKey }));
    } catch (error) {
      if (getStorageStatus(error) === 404) {
        throw new BadRequestException('Uploaded object could not be found.', { cause: error });
      }
      throw new ServiceUnavailableException('Image storage could not verify the uploaded object.', {
        cause: error,
      });
    }
    if (head.ContentLength !== input.size || head.ContentType !== input.contentType) {
      throw new BadRequestException('Uploaded file size or content type does not match.');
    }
    if (input.size > MAX_FILE_BYTES[objectKind]) {
      throw new BadRequestException('Uploaded file exceeds the allowed size.');
    }

    const object = await s3.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        Range: 'bytes=0-11',
      }),
    );
    const bytes = object.Body
      ? Buffer.from(await object.Body.transformToByteArray())
      : Buffer.alloc(0);
    if (!matchesImageType(bytes, input.contentType)) {
      throw new BadRequestException('Uploaded file content is not a valid declared image type.');
    }

    return { objectKey: input.objectKey, url: this.publicUrl(input.objectKey) };
  }

  async assertCardImage(
    ownerId: string,
    cardId: string,
    imageUrl: string,
    field?: ImageField,
  ): Promise<void> {
    await this.findOwnedCard(ownerId, cardId);
    const key = this.objectKeyFromPublicUrl(imageUrl);
    if (!key.startsWith(`cards/${ownerId}/${cardId}/`)) {
      throw new BadRequestException('Image must be an upload owned by this card.');
    }
    const objectKind = key.split('/')[3]?.toUpperCase();
    if (!isUploadKind(objectKind) || (field && objectKind !== field.toUpperCase())) {
      throw new BadRequestException('Image upload does not match the requested image field.');
    }

    const s3 = this.getS3();
    const head = await s3.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
    if (
      !head.ContentLength ||
      head.ContentLength > MAX_FILE_BYTES[objectKind] ||
      !isImageContentType(head.ContentType)
    ) {
      throw new BadRequestException('Image upload does not meet the allowed type or size.');
    }
    const object = await s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: 'bytes=0-11' }),
    );
    const bytes = object.Body
      ? Buffer.from(await object.Body.transformToByteArray())
      : Buffer.alloc(0);
    if (!matchesImageType(bytes, head.ContentType)) {
      throw new BadRequestException('Uploaded file content is not a valid image.');
    }
  }

  async assertCardImages(ownerId: string, cardId: string, imageUrls: string[]): Promise<void> {
    await Promise.all(imageUrls.map((url) => this.assertCardImage(ownerId, cardId, url)));
  }

  private async findOwnedCard(ownerId: string, cardId: string) {
    const card = await this.prisma.card.findFirst({
      where: { id: cardId, ownerId, deletedAt: null, status: { not: CardStatus.DELETED } },
      select: { id: true },
    });
    if (!card) throw new NotFoundException('Card not found.');
    return card;
  }

  private createToken(payload: UploadTokenPayload): string {
    const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
    return `${encoded}.${this.sign(encoded)}`;
  }

  private verifyToken(token: string): UploadTokenPayload {
    const [encoded, signature, extra] = token.split('.');
    if (!encoded || !signature || extra !== undefined) {
      throw new BadRequestException('Upload confirmation is invalid.');
    }
    const expected = Buffer.from(this.sign(encoded));
    const actual = Buffer.from(signature);
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      throw new BadRequestException('Upload confirmation is invalid.');
    }

    let payload: unknown;
    try {
      payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    } catch {
      throw new BadRequestException('Upload confirmation is invalid.');
    }
    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('ownerId' in payload) ||
      !('cardId' in payload) ||
      !('objectKey' in payload) ||
      !('contentType' in payload) ||
      !('size' in payload) ||
      !('expiresAt' in payload) ||
      typeof payload.ownerId !== 'string' ||
      typeof payload.cardId !== 'string' ||
      typeof payload.objectKey !== 'string' ||
      !isImageContentType(payload.contentType) ||
      typeof payload.size !== 'number' ||
      typeof payload.expiresAt !== 'number'
    ) {
      throw new BadRequestException('Upload confirmation is invalid.');
    }
    return {
      ownerId: payload.ownerId,
      cardId: payload.cardId,
      objectKey: payload.objectKey,
      contentType: payload.contentType,
      size: payload.size,
      expiresAt: payload.expiresAt,
    };
  }

  private sign(encoded: string): string {
    return createHmac('sha256', this.signatureSecret).update(encoded).digest('base64url');
  }

  private objectKeyFromPublicUrl(value: string): string {
    if (!this.publicBaseUrl) {
      throw storageNotConfiguredException();
    }
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      throw new BadRequestException('Image URL is invalid.');
    }
    const base = new URL(this.publicBaseUrl);
    if (
      url.origin !== base.origin ||
      !url.pathname.startsWith(`${base.pathname.replace(/\/+$/, '')}/`)
    ) {
      throw new BadRequestException(
        'Image URL is not served from the configured R2 public domain.',
      );
    }
    return url.pathname
      .slice(base.pathname.replace(/\/+$/, '').length + 1)
      .split('/')
      .map(decodeURIComponent)
      .join('/');
  }

  private publicUrl(objectKey: string): string {
    if (!this.publicBaseUrl) {
      throw storageNotConfiguredException();
    }
    return `${this.publicBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
  }

  private getS3(): S3Client {
    if (!this.s3) throw storageNotConfiguredException();
    return this.s3;
  }

  onModuleDestroy(): void {
    this.s3?.destroy();
  }
}

function storageNotConfiguredException(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'STORAGE_NOT_CONFIGURED',
    message: 'Image storage is not configured. Please contact support.',
  });
}

function isImageContentType(value: unknown): value is ImageContentType {
  return value === 'image/jpeg' || value === 'image/png' || value === 'image/webp';
}

function isUploadKind(value: unknown): value is UploadKind {
  return value === 'AVATAR' || value === 'COVER' || value === 'GALLERY' || value === 'PRODUCT';
}

function getStorageStatus(error: unknown): number | undefined {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('$metadata' in error) ||
    typeof error.$metadata !== 'object' ||
    error.$metadata === null ||
    !('httpStatusCode' in error.$metadata) ||
    typeof error.$metadata.httpStatusCode !== 'number'
  ) {
    return undefined;
  }
  return error.$metadata.httpStatusCode;
}

function matchesImageType(bytes: Buffer, contentType: ImageContentType): boolean {
  if (contentType === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (contentType === 'image/png') {
    return (
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    );
  }
  return (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  );
}
