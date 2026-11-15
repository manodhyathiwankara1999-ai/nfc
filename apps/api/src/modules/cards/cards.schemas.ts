import { z } from 'zod';
import {
  CardOfficeUpdateSchema,
  CardDataSchema,
  CardProductCreateSchema,
  CardProductReorderSchema,
  CardProductUpdateSchema,
  CardProfileUpdateSchema,
  CardPurposeSchema,
  CardProductsSchema,
  CardSlugSchema as SharedCardSlugSchema,
} from '@nfc/shared';

export { CardDataSchema };

export const CardClaimSchema = z
  .object({
    claimCode: z.string().trim().min(20).max(100),
  })
  .strict();

export const CardCreateSchema = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
  })
  .strict();

export const CardSlugSchema = SharedCardSlugSchema;
export const CardIdSchema = z.string().uuid();
export const CardProfilePatchSchema = CardProfileUpdateSchema;
export const CardOfficePatchSchema = CardOfficeUpdateSchema;
export const ProductCreateSchema = CardProductCreateSchema;
export const ProductUpdateSchema = CardProductUpdateSchema;
export const ProductReorderSchema = CardProductReorderSchema;

export const CardUploadPresignSchema = z
  .object({
    kind: z.enum(['AVATAR', 'COVER', 'GALLERY', 'PRODUCT']),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().positive(),
  })
  .strict();

export const CardUploadConfirmSchema = z
  .object({
    objectKey: z.string().min(1).max(512),
    contentType: z.enum(['image/jpeg', 'image/png', 'image/webp']),
    size: z.number().int().positive(),
    token: z.string().min(32).max(512),
  })
  .strict();

export const AdminCardCreateSchema = z
  .object({
    ownerEmail: z
      .string()
      .trim()
      .email()
      .max(320)
      .transform((email) => email.toLowerCase()),
    slug: SharedCardSlugSchema.optional(),
    purpose: CardPurposeSchema,
    customPurpose: z.string().trim().min(2).max(80).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.purpose === 'OTHER' && !input.customPurpose) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customPurpose'],
        message: 'Enter a label for the selected purpose.',
      });
    }
    if (input.purpose !== 'OTHER' && input.customPurpose !== undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['customPurpose'],
        message: 'A custom purpose label is only valid when purpose is Other.',
      });
    }
  });

export const AdminCardUpdateSchema = z
  .object({
    card: CardDataSchema.optional(),
    profile: CardProfilePatchSchema.optional(),
    office: CardOfficePatchSchema.optional(),
    products: CardProductsSchema.optional(),
  })
  .strict()
  .refine((input) => Object.keys(input).length > 0, 'At least one card field is required.');

export const AdminCardSearchSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    ownerEmail: z.string().trim().email().max(320).optional(),
    name: z.string().trim().max(100).optional(),
    slug: z.string().trim().max(100).optional(),
    status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED', 'LOST', 'DELETED']).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const AdminUserSearchSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
  })
  .strict();

export const AdminAuditSearchSchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(50),
  })
  .strict();
