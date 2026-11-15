import 'dotenv/config';
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const extensions: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

async function main() {
  const apply = process.argv.includes('--apply');
  const sourceUrl = process.env.SUPABASE_STORAGE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const cdnBaseUrl = process.env.R2_PUBLIC_BASE_URL?.replace(/\/+$/, '');
  const accountId = process.env.R2_ACCOUNT_ID;
  const bucket = process.env.R2_BUCKET_NAME;
  if (
    !cdnBaseUrl ||
    !accountId ||
    !bucket ||
    !process.env.R2_ACCESS_KEY_ID ||
    !process.env.R2_SECRET_ACCESS_KEY
  ) {
    throw new Error('R2 credentials, bucket, and R2_PUBLIC_BASE_URL must be configured.');
  }
  if (apply && (!sourceUrl || !serviceRoleKey)) {
    throw new Error(
      'SUPABASE_STORAGE_URL and SUPABASE_SERVICE_ROLE_KEY are required with --apply.',
    );
  }
  const sourceOrigin = sourceUrl ? new URL(sourceUrl).origin : '';
  const prisma = new PrismaClient();
  const r2 = new S3Client({
    region: 'auto',
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  });

  try {
    const profiles = await prisma.profile.findMany({
      where: { avatarUrl: { not: null } },
      select: { id: true, userId: true, avatarUrl: true },
      orderBy: { id: 'asc' },
    });
    const sourceProfiles = profiles.filter(
      (profile) => profile.avatarUrl && !profile.avatarUrl.startsWith(`${cdnBaseUrl}/`),
    );
    console.info(
      `Found ${sourceProfiles.length} profile avatar(s) requiring migration. Mode: ${apply ? 'apply' : 'dry-run'}.`,
    );

    for (const profile of sourceProfiles) {
      const avatarUrl = profile.avatarUrl;
      if (!avatarUrl) continue;
      const parsed = new URL(avatarUrl);
      if (parsed.origin !== sourceOrigin)
        throw new Error(`Avatar source origin is not allowed for profile ${profile.id}.`);
      const match = parsed.pathname.match(
        /^\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/(.+)$/,
      );
      if (!match)
        throw new Error(
          `Avatar URL for profile ${profile.id} is not a supported Supabase Storage URL.`,
        );
      const [, sourceBucket, encodedKey] = match;
      if (sourceBucket !== (process.env.SUPABASE_AVATAR_BUCKET ?? 'avatars')) {
        throw new Error(
          `Avatar for profile ${profile.id} is outside the configured avatar bucket.`,
        );
      }
      const sourceKey = encodedKey.split('/').map(decodeURIComponent).join('/');
      if (!apply) {
        console.info(`Would migrate profile ${profile.id} from bucket ${sourceBucket}.`);
        continue;
      }

      const response = await fetch(
        `${sourceOrigin}/storage/v1/object/${sourceBucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
        { headers: { authorization: `Bearer ${serviceRoleKey}`, apikey: serviceRoleKey! } },
      );
      if (!response.ok)
        throw new Error(
          `Could not download avatar for profile ${profile.id} (${response.status}).`,
        );
      const contentType = response.headers.get('content-type')?.split(';')[0]?.toLowerCase() ?? '';
      const extension = extensions[contentType];
      if (!extension)
        throw new Error(`Avatar for profile ${profile.id} has a disallowed content type.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length === 0 || bytes.length > MAX_AVATAR_BYTES) {
        throw new Error(`Avatar for profile ${profile.id} has an invalid size.`);
      }
      const objectKey = `users/${profile.userId}/avatar/${profile.id}.${extension}`;
      await r2.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: bytes,
          ContentType: contentType,
        }),
      );
      const publicUrl = `${cdnBaseUrl}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
      await prisma.$transaction(async (transaction) => {
        await transaction.asset.upsert({
          where: { objectKey },
          create: {
            userId: profile.userId,
            profileId: profile.id,
            kind: 'AVATAR',
            objectKey,
            contentType,
            size: bytes.length,
            confirmedAt: new Date(),
          },
          update: {
            profileId: profile.id,
            kind: 'AVATAR',
            contentType,
            size: bytes.length,
            confirmedAt: new Date(),
            deletedAt: null,
          },
        });
        await transaction.profile.update({
          where: { id: profile.id },
          data: { avatarUrl: publicUrl },
        });
      });
      console.info(`Migrated profile ${profile.id}.`);
    }
  } finally {
    r2.destroy();
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Avatar migration failed.');
  process.exitCode = 1;
});
