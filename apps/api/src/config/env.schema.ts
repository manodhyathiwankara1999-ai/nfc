import { z } from 'zod';
import { isIP } from 'node:net';

const postgresUrl = (label: string) =>
  z
    .string()
    .url()
    .superRefine((value, context) => {
      const parsed = new URL(value);
      if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
        context.addIssue({ code: z.ZodIssueCode.custom, message: `${label} must use PostgreSQL.` });
      }
    });

const corsOrigins = z
  .string()
  .min(1)
  .transform((value) => value.split(',').map((origin) => origin.trim()))
  .refine(
    (origins) =>
      origins.length > 0 &&
      origins.every((origin) => {
        try {
          const parsed = new URL(origin);
          return (
            (parsed.protocol === 'http:' || parsed.protocol === 'https:') &&
            parsed.origin === origin
          );
        } catch {
          return false;
        }
      }),
    'CORS_ORIGINS must be a comma-separated list of HTTP(S) origins.',
  );

const trustedProxyIps = z
  .string()
  .optional()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean),
  )
  .refine(
    (entries) =>
      entries.every((entry) => {
        const [address, prefix, extra] = entry.split('/');
        if (extra !== undefined || !address || isIP(address) === 0) return false;
        if (prefix === undefined) return true;
        const length = Number(prefix);
        return (
          Number.isInteger(length) && length >= 0 && length <= (isIP(address) === 4 ? 32 : 128)
        );
      }),
    'TRUSTED_PROXY_IPS must be a comma-separated list of IP addresses or CIDRs.',
  );

const optionalSecret = z.string().optional().default('');
const supabaseUrl = z
  .string()
  .url()
  .refine((value) => {
    try {
      return ['http:', 'https:'].includes(new URL(value).protocol);
    } catch {
      return false;
    }
  }, 'SUPABASE_URL must use HTTP(S).');

export const EnvironmentSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(4000),
    WEB_APP_URL: z.string().url().default('http://localhost:3000'),
    REVALIDATION_SECRET: z.string().min(32),
    TRUSTED_PROXY_IPS: trustedProxyIps,
    SUPABASE_URL: supabaseUrl,
    SUPABASE_ANON_KEY: z.string().min(1),
    MAX_CARDS_PER_USER: z.coerce.number().int().min(1).max(100).default(5),
    DATABASE_URL: postgresUrl('DATABASE_URL').superRefine((value, context) => {
      const parsed = new URL(value);
      if (parsed.port !== '6543') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL must use pooler port 6543.',
        });
      }
      if (parsed.searchParams.get('pgbouncer') !== 'true') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL must set pgbouncer=true.',
        });
      }
      if (parsed.searchParams.get('connection_limit') !== '1') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DATABASE_URL must set connection_limit=1.',
        });
      }
    }),
    DIRECT_URL: postgresUrl('DIRECT_URL').superRefine((value, context) => {
      const parsed = new URL(value);
      if (parsed.port !== '5432') {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'DIRECT_URL must use port 5432.',
        });
      }
    }),
    CORS_ORIGINS: corsOrigins,
    R2_ACCOUNT_ID: optionalSecret,
    R2_ACCESS_KEY_ID: optionalSecret,
    R2_SECRET_ACCESS_KEY: optionalSecret,
    R2_BUCKET_NAME: optionalSecret,
    R2_PUBLIC_BASE_URL: z
      .union([
        z.literal(''),
        z
          .string()
          .url()
          .refine((value) => new URL(value).protocol === 'https:'),
      ])
      .optional()
      .default(''),
    GALLERY_MAX_IMAGES: z.coerce.number().int().min(1).max(30).default(30),
    ANALYTICS_RAW_RETENTION_DAYS: z.coerce.number().int().min(90).max(3650).default(365),
    IP_HASH_SALT: z.string().min(32),
    SENTRY_DSN: z
      .union([z.literal(''), z.string().url()])
      .optional()
      .default(''),
  })
  .superRefine((env, context) => {
    const integrations: Array<[string, string[]]> = [
      [
        'Cloudflare R2',
        [
          env.R2_ACCOUNT_ID,
          env.R2_ACCESS_KEY_ID,
          env.R2_SECRET_ACCESS_KEY,
          env.R2_BUCKET_NAME,
          env.R2_PUBLIC_BASE_URL,
        ],
      ],
    ];
    for (const [name, values] of integrations) {
      if (values.some(Boolean) && values.some((value) => !value)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Configure every setting for ${name}, or leave all of its settings empty.`,
        });
      }
    }
  });

export type ApiEnvironment = z.infer<typeof EnvironmentSchema>;

export function validateEnvironment(environment: Record<string, unknown>): ApiEnvironment {
  const parsed = EnvironmentSchema.safeParse(environment);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || 'environment'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid API environment configuration: ${issues}`);
  }
  return parsed.data;
}
