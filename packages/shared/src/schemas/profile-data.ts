import { z } from 'zod';

export const DEFAULT_PROFILE_THEME_COLOR = '#4f46e5';
export const PROFILE_IMAGE_LIMITS = {
  AVATAR: 2 * 1024 * 1024,
  COVER: 5 * 1024 * 1024,
  GALLERY: 5 * 1024 * 1024,
} as const;
export const MAX_PROFILE_GALLERY_IMAGES = 30;

const RESERVED_PROFILE_SLUGS = new Set([
  'about',
  'admin',
  'api',
  'auth',
  'billing',
  'contact',
  'dashboard',
  'download',
  'forgot-password',
  'help',
  'login',
  'logout',
  'pricing',
  'privacy',
  'profile',
  'profiles',
  'public',
  'register',
  'reset-password',
  'settings',
  'support',
  'terms',
  'u',
  'user',
  'users',
  'verify-email',
]);

const OptionalTextSchema = (maximum: number) => z.string().trim().max(maximum).optional();

const HttpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url('Enter a valid URL.')
  .refine((value) => {
    try {
      return new URL(value).protocol === 'https:';
    } catch {
      return false;
    }
  }, 'URL must use HTTPS.');

const OptionalHttpsUrlSchema = z
  .union([HttpsUrlSchema, z.literal('')])
  .nullable()
  .optional()
  .transform((value) => (value === '' ? null : value));

const PhoneSchema = z
  .string()
  .trim()
  .max(40)
  .transform((value) => value.replace(/[\s()-]/g, ''))
  .refine((value) => value === '' || /^\+[1-9]\d{1,14}$/.test(value), {
    message: 'Enter a phone number in international format, such as +94771234567.',
  })
  .optional();

const EmailSchema = z
  .union([
    z
      .string()
      .trim()
      .max(254)
      .email('Enter a valid email address.')
      .transform((value) => value.toLowerCase()),
    z.literal(''),
  ])
  .optional()
  .transform((value) => (value === '' ? null : value));

export const ProfileSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(30)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.')
  .refine((value) => !RESERVED_PROFILE_SLUGS.has(value), 'This profile URL is reserved.');

export const ProfileImageUrlSchema = HttpsUrlSchema;

export const ProfileDataFieldsSchema = z.object({
  fullName: z.string().trim().min(2, 'Enter at least 2 characters.').max(100),
  jobTitle: OptionalTextSchema(100),
  skillsLine: z
    .string()
    .trim()
    .max(120)
    .optional()
    .refine(
      (value) =>
        value === undefined ||
        value === '' ||
        (value.split(/[,|]/).every((skill) => skill.trim().length > 0) &&
          value.split(/[,|]/).length <= 3),
      'Enter up to 3 skills, separated by commas or vertical bars.',
    ),
  tagline: OptionalTextSchema(80),
  avatar: OptionalHttpsUrlSchema,
  coverImage: OptionalHttpsUrlSchema,
  galleryImages: z.array(ProfileImageUrlSchema).max(MAX_PROFILE_GALLERY_IMAGES).default([]),
  phone: PhoneSchema,
  email: EmailSchema,
  location: OptionalTextSchema(100),
  website: OptionalHttpsUrlSchema,
  linkedinUrl: OptionalHttpsUrlSchema,
  githubUrl: OptionalHttpsUrlSchema,
  themeColor: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color such as #4f46e5.')
    .default(DEFAULT_PROFILE_THEME_COLOR),
  slug: ProfileSlugSchema,
});

export function validateProfileSocialUrls(
  profile: {
    linkedinUrl?: string | null;
    githubUrl?: string | null;
  },
  context: z.RefinementCtx,
) {
  if (profile.linkedinUrl) {
    const host = new URL(profile.linkedinUrl).hostname.toLowerCase();
    if (host !== 'linkedin.com' && host !== 'www.linkedin.com') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linkedinUrl'],
        message: 'Enter a LinkedIn URL on linkedin.com.',
      });
    }
  }
  if (profile.githubUrl) {
    const host = new URL(profile.githubUrl).hostname.toLowerCase();
    if (host !== 'github.com' && host !== 'www.github.com') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['githubUrl'],
        message: 'Enter a GitHub URL on github.com.',
      });
    }
  }
}

export const ProfileDataSchema = ProfileDataFieldsSchema.superRefine(validateProfileSocialUrls);
export const ProfileDataUpdateSchema = ProfileDataFieldsSchema.omit({
  galleryImages: true,
})
  .partial()
  .superRefine(validateProfileSocialUrls);

export const ProfileImageUploadSchema = z
  .object({
    kind: z.enum(['AVATAR', 'COVER', 'GALLERY']),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().positive(),
  })
  .superRefine((upload, context) => {
    if (upload.size > PROFILE_IMAGE_LIMITS[upload.kind]) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['size'],
        message: `Image exceeds the ${PROFILE_IMAGE_LIMITS[upload.kind] / (1024 * 1024)} MB limit.`,
      });
    }
  });

export type ProfileData = z.infer<typeof ProfileDataSchema>;
export type ProfileDataUpdate = z.infer<typeof ProfileDataUpdateSchema>;
export type ProfileImageUpload = z.infer<typeof ProfileImageUploadSchema>;
