import { z } from 'zod';
import { AccountType } from '../enums';

export const SlugSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single dashes.');

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  slug: SlugSchema,
  display_name: z.string().nullable(),
  title: z.string().nullable(),
  bio: z.string().nullable(),
  avatar_url: z.string().nullable(),
  profile_type: z.nativeEnum(AccountType),
  is_public: z.boolean(),
  theme: z.record(z.unknown()),
  created_at: z.string().datetime({ offset: true }),
});

export const ProfileUpdateSchema = z.object({
  display_name: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  bio: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  slug: SlugSchema.optional(),
  is_public: z.boolean().optional(),
});

export type Profile = z.infer<typeof ProfileSchema>;
export type ProfileUpdate = z.infer<typeof ProfileUpdateSchema>;
export type Slug = z.infer<typeof SlugSchema>;
