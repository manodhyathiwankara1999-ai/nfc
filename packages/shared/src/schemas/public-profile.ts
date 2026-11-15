import { z } from 'zod';
import {
  CardSocialLinkSchema,
  CardOfficeSchema,
  CardProductResponseSchema,
  CardProfileDataSchema,
} from './cards';
import { ProfileTemplateSelectionSchema } from '../profile-templates';

export const PublicCardResponseSchema = z.discriminatedUnion('status', [
  z.object({
    slug: z.string().min(3).max(48),
    status: z.literal('active'),
    profile: CardProfileDataSchema,
    office: CardOfficeSchema.nullable(),
    products: z.array(CardProductResponseSchema).max(5),
  }),
  z
    .object({
      status: z.literal('inactive'),
      name: z.string().min(1).max(100),
    })
    .strict(),
]);

export type PublicCardResponse = z.infer<typeof PublicCardResponseSchema>;

const OptionalPublicTextSchema = z.string().nullable();
const PublicHttpsUrlSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).protocol === 'https:');
const OptionalPublicUrlSchema = PublicHttpsUrlSchema.nullable();

export const PublicProfileApiSchema = z.object({
  slug: z.string().min(3).max(100),
  fullName: z.string().min(2).max(100),
  jobTitle: OptionalPublicTextSchema,
  skillsLine: OptionalPublicTextSchema,
  tagline: OptionalPublicTextSchema,
  avatar: OptionalPublicUrlSchema,
  coverImage: OptionalPublicUrlSchema,
  phone: OptionalPublicTextSchema,
  email: z.string().email().nullable(),
  location: OptionalPublicTextSchema,
  website: OptionalPublicUrlSchema,
  linkedinUrl: OptionalPublicUrlSchema,
  githubUrl: OptionalPublicUrlSchema,
  socialLinks: z.array(CardSocialLinkSchema).max(20).optional().default([]),
  galleryImages: z
    .array(
      z.object({
        url: PublicHttpsUrlSchema,
        alt: z.string().max(160),
        caption: z.string().max(300).nullable(),
      }),
    )
    .max(30),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  templateId: ProfileTemplateSelectionSchema.default(null),
  isIndexable: z.boolean(),
});

export const PublicProfileResponseSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('profile'), profile: PublicProfileApiSchema }),
  z.object({ kind: z.literal('redirect'), slug: z.string().min(3).max(48) }),
]);

export type PublicProfileApi = z.infer<typeof PublicProfileApiSchema>;
export type PublicProfileResponse = z.infer<typeof PublicProfileResponseSchema>;
