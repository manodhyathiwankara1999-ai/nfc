import 'reflect-metadata';
import { PrismaClient, Role, ThemeCategory } from '@prisma/client';
import { randomBytes, scrypt as scryptCallback } from 'node:crypto';
import { promisify } from 'node:util';
import { z } from 'zod';
import { validateEnvironment } from '../src/config/env.schema';

const scrypt = promisify(scryptCallback);
const SuperAdminUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
  .transform((username) => username.toLowerCase());
const SuperAdminPasswordSchema = z.string().min(12).max(128);
const SuperAdminSeedEnvironmentSchema = z.object({
  SUPER_ADMIN_USERNAME: SuperAdminUsernameSchema,
  SUPER_ADMIN_PASSWORD: SuperAdminPasswordSchema,
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
});
const AdminAuthUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});
const AdminAuthUsersSchema = z.object({ users: z.array(z.unknown()) });

const themes = [
  {
    key: 'technology',
    name: 'Technology',
    category: ThemeCategory.TECHNOLOGY,
    backgroundConfigKey: 'aurora-gradient',
    palette: { primary: '#2563eb', secondary: '#0f172a', accent: '#06b6d4' },
  },
  {
    key: 'healthcare',
    name: 'Healthcare',
    category: ThemeCategory.HEALTHCARE,
    backgroundConfigKey: 'soft-waves',
    palette: { primary: '#0d9488', secondary: '#134e4a', accent: '#5eead4' },
  },
  {
    key: 'real-estate',
    name: 'Real Estate',
    category: ThemeCategory.REAL_ESTATE,
    backgroundConfigKey: 'geometric-grid',
    palette: { primary: '#15803d', secondary: '#14532d', accent: '#d4a373' },
  },
  {
    key: 'legal',
    name: 'Legal',
    category: ThemeCategory.LEGAL,
    backgroundConfigKey: 'minimal-lines',
    palette: { primary: '#1e3a8a', secondary: '#172554', accent: '#d4af37' },
  },
  {
    key: 'education',
    name: 'Education',
    category: ThemeCategory.EDUCATION,
    backgroundConfigKey: 'soft-waves',
    palette: { primary: '#7c3aed', secondary: '#312e81', accent: '#fbbf24' },
  },
  {
    key: 'finance',
    name: 'Finance',
    category: ThemeCategory.FINANCE,
    backgroundConfigKey: 'minimal-lines',
    palette: { primary: '#047857', secondary: '#064e3b', accent: '#cbd5e1' },
  },
  {
    key: 'creative',
    name: 'Creative',
    category: ThemeCategory.CREATIVE,
    backgroundConfigKey: 'particles',
    palette: { primary: '#db2777', secondary: '#701a75', accent: '#f97316' },
  },
  {
    key: 'hospitality',
    name: 'Hospitality',
    category: ThemeCategory.HOSPITALITY,
    backgroundConfigKey: 'warm-gradient',
    palette: { primary: '#be123c', secondary: '#881337', accent: '#fda4af' },
  },
  {
    key: 'construction',
    name: 'Construction',
    category: ThemeCategory.CONSTRUCTION,
    backgroundConfigKey: 'geometric-grid',
    palette: { primary: '#b45309', secondary: '#451a03', accent: '#facc15' },
  },
  {
    key: 'retail',
    name: 'Retail',
    category: ThemeCategory.RETAIL,
    backgroundConfigKey: 'particles',
    palette: { primary: '#4f46e5', secondary: '#1e1b4b', accent: '#f472b6' },
  },
  {
    key: 'automotive',
    name: 'Automotive',
    category: ThemeCategory.AUTOMOTIVE,
    backgroundConfigKey: 'geometric-grid',
    palette: { primary: '#dc2626', secondary: '#450a0a', accent: '#94a3b8' },
  },
  {
    key: 'beauty-wellness',
    name: 'Beauty/Wellness',
    category: ThemeCategory.BEAUTY_WELLNESS,
    backgroundConfigKey: 'soft-waves',
    palette: { primary: '#c026d3', secondary: '#581c87', accent: '#fbcfe8' },
  },
  {
    key: 'generic',
    name: 'Generic',
    category: ThemeCategory.GENERIC,
    backgroundConfigKey: 'generic-solid',
    palette: { primary: '#4f46e5', secondary: '#0f172a', accent: '#f59e0b' },
  },
] as const;

export function superAdminEmailForUsername(username: string): string {
  const normalizedUsername = SuperAdminUsernameSchema.parse(username);
  return `super-admin.${normalizedUsername}@internal.nfc-ecard.invalid`;
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, 64);
  if (!Buffer.isBuffer(derivedKey)) throw new Error('Password hashing failed.');
  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

async function findSupabaseUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  email: string,
): Promise<z.infer<typeof AdminAuthUserSchema> | null> {
  const url = new URL('/auth/v1/admin/users', supabaseUrl);
  url.searchParams.set('filter', email);
  url.searchParams.set('per_page', '1000');

  const response = await fetch(url, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error('Could not look up the reserved Supabase Auth account.');

  const result = AdminAuthUsersSchema.safeParse(await response.json());
  if (!result.success) throw new Error('Supabase returned an invalid user list.');
  for (const candidate of result.data.users) {
    const parsedUser = AdminAuthUserSchema.safeParse(candidate);
    if (parsedUser.success && parsedUser.data.email.toLowerCase() === email.toLowerCase()) {
      return parsedUser.data;
    }
  }
  return null;
}

async function saveSupabaseUser(
  supabaseUrl: string,
  serviceRoleKey: string,
  existingUser: z.infer<typeof AdminAuthUserSchema> | null,
  email: string,
  password: string,
): Promise<z.infer<typeof AdminAuthUserSchema>> {
  const url = new URL(
    existingUser ? `/auth/v1/admin/users/${existingUser.id}` : '/auth/v1/admin/users',
    supabaseUrl,
  );
  const response = await fetch(url, {
    method: existingUser ? 'PUT' : 'POST',
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok)
    throw new Error('Could not create or update the reserved Supabase Auth account.');

  const payload: unknown = await response.json();
  const directResult = AdminAuthUserSchema.safeParse(payload);
  const nestedResult =
    typeof payload === 'object' && payload !== null && 'user' in payload
      ? AdminAuthUserSchema.safeParse(payload.user)
      : null;
  const user = directResult.success
    ? directResult.data
    : nestedResult?.success
      ? nestedResult.data
      : null;
  if (!user || user.email.toLowerCase() !== email.toLowerCase()) {
    throw new Error('Supabase returned an invalid reserved account.');
  }
  return user;
}

async function seedSuperAdmin(prisma: PrismaClient): Promise<void> {
  const environment = validateEnvironment(process.env);
  const seedEnvironment = SuperAdminSeedEnvironmentSchema.parse(process.env);
  const { SUPER_ADMIN_USERNAME: username, SUPER_ADMIN_PASSWORD: password } = seedEnvironment;
  const serviceRoleKey = seedEnvironment.SUPABASE_SERVICE_ROLE_KEY;

  const email = superAdminEmailForUsername(username);
  const currentAccount = await prisma.user.findUnique({
    where: { email },
    select: { id: true, supabaseUserId: true, deletedAt: true },
  });
  if (currentAccount?.deletedAt) {
    throw new Error(
      'The reserved super-admin account is soft-deleted; restore it explicitly first.',
    );
  }

  const foundAuthUser = await findSupabaseUser(environment.SUPABASE_URL, serviceRoleKey, email);
  if (currentAccount?.supabaseUserId && currentAccount.supabaseUserId !== foundAuthUser?.id) {
    throw new Error('The database super-admin account is linked to a different Auth identity.');
  }
  if (foundAuthUser) {
    const accountByAuthId = await prisma.user.findUnique({
      where: { supabaseUserId: foundAuthUser.id },
      select: { id: true, email: true },
    });
    if (accountByAuthId && accountByAuthId.email !== email) {
      throw new Error('The reserved Auth identity is linked to a different database account.');
    }
  }

  const passwordHash = await hashPassword(password);
  const authUser = await saveSupabaseUser(
    environment.SUPABASE_URL,
    serviceRoleKey,
    foundAuthUser,
    email,
    password,
  );

  await prisma.user.upsert({
    where: { email },
    update: {
      name: username,
      supabaseUserId: authUser.id,
      passwordHash,
      passwordHashAlgo: 'scrypt',
      role: Role.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
    },
    create: {
      email,
      name: username,
      supabaseUserId: authUser.id,
      passwordHash,
      passwordHashAlgo: 'scrypt',
      role: Role.SUPER_ADMIN,
      emailVerifiedAt: new Date(),
    },
  });
}

async function seed(): Promise<void> {
  const prisma = new PrismaClient();
  try {
    await seedSuperAdmin(prisma);
    for (const theme of themes) {
      await prisma.theme.upsert({
        where: { key: theme.key },
        update: {
          name: theme.name,
          category: theme.category,
          palette: theme.palette,
          backgroundConfigKey: theme.backgroundConfigKey,
        },
        create: {
          ...theme,
        },
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  void seed().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Database seed failed.');
    process.exitCode = 1;
  });
}
