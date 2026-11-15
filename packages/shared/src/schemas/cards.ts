import { z } from 'zod';
import { ProfileTemplateSelectionSchema } from '../profile-templates';

export const CARD_PURPOSES = [
  'PERSONAL',
  'BUSINESS_OWNER',
  'FREELANCER',
  'EMPLOYEE',
  'DOCTOR',
  'LAWYER',
  'TEACHER',
  'STUDENT',
  'REAL_ESTATE',
  'OTHER',
] as const;

export const CARD_STATUSES = ['ACTIVE', 'INACTIVE', 'DELETED'] as const;
export const CARD_CREATORS = ['OWNER', 'SUPER_ADMIN'] as const;
export const MAX_CARD_PRODUCTS = 5;

const RESERVED_CARD_SLUGS = new Set([
  'about',
  'admin',
  'api',
  'auth',
  'billing',
  'cards',
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
  'super-admin',
  'support',
  'terms',
  'u',
  'user',
  'users',
  'verify-email',
]);

const OptionalTextSchema = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.null()])
    .optional()
    .transform((value) => value || null);

const OptionalTextPatchSchema = (maximum: number) =>
  z
    .union([z.string().trim().max(maximum), z.literal(''), z.null()])
    .optional()
    .transform((value) => (value === '' ? null : value));

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

const HttpsUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .url('Enter a valid URL.')
  .refine(isHttpsUrl, 'URL must use HTTPS.');

const OptionalHttpsUrlSchema = z
  .union([HttpsUrlSchema, z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value));

const E164PhoneSchema = z
  .union([
    z
      .string()
      .trim()
      .max(16)
      .regex(/^\+[1-9]\d{1,14}$/, 'Use an E.164 phone number, such as +94771234567.'),
    z.null(),
  ])
  .optional()
  .transform((value) => value || null);

const EmailSchema = z
  .union([
    z
      .string()
      .trim()
      .max(254)
      .email('Enter a valid email address.')
      .transform((value) => value.toLowerCase()),
    z.null(),
  ])
  .optional()
  .transform((value) => value || null);

export const CardSlugSchema = z
  .string()
  .trim()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers, and single hyphens.')
  .refine((value) => !RESERVED_CARD_SLUGS.has(value), 'This card URL is reserved.');

export const CardPurposeSchema = z.enum(CARD_PURPOSES);

const CardDataFieldsSchema = z.object({
  slug: CardSlugSchema,
  purpose: CardPurposeSchema,
  customPurpose: z.string().trim().min(2).max(80).optional(),
});

function validateCardPurpose(card: z.infer<typeof CardDataFieldsSchema>, context: z.RefinementCtx) {
  if (card.purpose === 'OTHER' && !card.customPurpose) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customPurpose'],
      message: 'Enter a label for the selected purpose.',
    });
  }
  if (card.purpose !== 'OTHER' && card.customPurpose !== undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['customPurpose'],
      message: 'A custom purpose label is only valid when purpose is Other.',
    });
  }
}

export const CardDataSchema = CardDataFieldsSchema.superRefine(validateCardPurpose);

export const CardSocialLinkSchema = z
  .object({
    platform: z.enum([
      'WEBSITE',
      'LINKEDIN',
      'GITHUB',
      'INSTAGRAM',
      'FACEBOOK',
      'X',
      'YOUTUBE',
      'TIKTOK',
    ]),
    url: HttpsUrlSchema,
  })
  .superRefine((link, context) => {
    let hostname: string;
    try {
      hostname = new URL(link.url).hostname.toLowerCase();
    } catch {
      return;
    }
    const domains: Partial<Record<typeof link.platform, string[]>> = {
      LINKEDIN: ['linkedin.com'],
      GITHUB: ['github.com'],
      INSTAGRAM: ['instagram.com'],
      FACEBOOK: ['facebook.com', 'fb.com'],
      X: ['x.com', 'twitter.com'],
      YOUTUBE: ['youtube.com', 'youtu.be'],
      TIKTOK: ['tiktok.com'],
    };
    const allowed = domains[link.platform];
    if (
      allowed &&
      !allowed.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: `Enter a URL on the official ${link.platform.toLowerCase()} domain.`,
      });
    }
  });

export const CardProfileDataSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  jobTitle: OptionalTextSchema(100),
  skillsLine: OptionalTextSchema(120),
  tagline: OptionalTextSchema(120),
  avatar: OptionalHttpsUrlSchema,
  cover: OptionalHttpsUrlSchema,
  contact: z.object({
    phone: E164PhoneSchema,
    email: EmailSchema,
    location: OptionalTextSchema(100),
    website: OptionalHttpsUrlSchema,
  }),
  socialLinks: z.array(CardSocialLinkSchema).max(20),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex color.'),
  templateId: ProfileTemplateSelectionSchema.default(null),
  gallery: z.array(HttpsUrlSchema).max(30),
  showProducts: z.boolean(),
});

export const CardProfileUpdateSchema = z
  .object({
    fullName: z.string().trim().min(2).max(100).optional(),
    jobTitle: OptionalTextPatchSchema(100),
    skillsLine: OptionalTextPatchSchema(120),
    tagline: OptionalTextPatchSchema(120),
    avatar: OptionalHttpsUrlSchema,
    cover: OptionalHttpsUrlSchema,
    contact: z
      .object({
        phone: z
          .union([
            z
              .string()
              .trim()
              .max(16)
              .regex(/^\+[1-9]\d{1,14}$/),
            z.literal(''),
            z.null(),
          ])
          .optional(),
        email: z
          .union([
            z
              .string()
              .trim()
              .max(254)
              .email()
              .transform((value) => value.toLowerCase()),
            z.literal(''),
            z.null(),
          ])
          .optional(),
        location: OptionalTextPatchSchema(100),
        website: OptionalHttpsUrlSchema,
      })
      .strict()
      .optional(),
    socialLinks: CardProfileDataSchema.shape.socialLinks.optional(),
    themeColor: CardProfileDataSchema.shape.themeColor.optional(),
    templateId: ProfileTemplateSelectionSchema.optional(),
    gallery: CardProfileDataSchema.shape.gallery.optional(),
    showProducts: z.boolean().optional(),
  })
  .strict();

export const CardOfficeSchema = z
  .object({
    hasOffice: z.boolean(),
    companyName: OptionalTextSchema(160),
    designation: OptionalTextSchema(100),
    department: OptionalTextSchema(100),
    officeAddress: OptionalTextSchema(500),
    officePhone: E164PhoneSchema,
    officeEmail: EmailSchema,
    companyWebsite: OptionalHttpsUrlSchema,
    workingHours: OptionalTextSchema(160),
  })
  .superRefine((office, context) => {
    if (office.hasOffice && !office.companyName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyName'],
        message: 'Enter a company name when office details are enabled.',
      });
    }
  });

export const CardOfficeUpdateSchema = z
  .object({
    hasOffice: z.boolean().optional(),
    companyName: OptionalTextPatchSchema(160),
    designation: OptionalTextPatchSchema(100),
    department: OptionalTextPatchSchema(100),
    officeAddress: OptionalTextPatchSchema(500),
    officePhone: z
      .union([
        z
          .string()
          .trim()
          .max(16)
          .regex(/^\+[1-9]\d{1,14}$/),
        z.literal(''),
        z.null(),
      ])
      .optional(),
    officeEmail: z
      .union([
        z
          .string()
          .trim()
          .max(254)
          .email()
          .transform((value) => value.toLowerCase()),
        z.literal(''),
        z.null(),
      ])
      .optional(),
    companyWebsite: OptionalHttpsUrlSchema,
    workingHours: OptionalTextPatchSchema(160),
  })
  .strict()
  .superRefine((office, context) => {
    if (office.hasOffice === true && office.companyName === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['companyName'],
        message: 'A company name is required when office details are enabled.',
      });
    }
  });

const CardProductFieldsSchema = z.object({
  image: z
    .string()
    .trim()
    .min(1, 'Choose a photo before saving.')
    .max(2048, 'The image URL is too long.')
    .refine((value) => value === '' || isHttpsUrl(value), 'Enter a valid HTTPS link to the image.'),
  name: z
    .string()
    .trim()
    .min(1, 'Enter a name for this product or service.')
    .max(100, 'Names must be 100 characters or fewer.'),
  price: z
    .number()
    .finite()
    .min(0, 'Price cannot be negative.')
    .max(9_999_999_999.99, 'Price is too high.')
    .optional()
    .nullable(),
  currency: z.string().regex(/^[A-Z]{3}$/, 'Use a three-letter uppercase currency code.'),
  detail: z.string().trim().max(120, 'Short descriptions must be 120 characters or fewer.'),
  sortOrder: z
    .number()
    .int()
    .min(0)
    .max(MAX_CARD_PRODUCTS - 1),
});

function validateProductPrice(product: { price?: number | null }, context: z.RefinementCtx): void {
  if (
    product.price !== null &&
    product.price !== undefined &&
    Number(product.price.toFixed(2)) !== product.price
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['price'],
      message: 'Price can have no more than two decimal places.',
    });
  }
}

export const CardProductSchema = CardProductFieldsSchema.superRefine(validateProductPrice);
export const CardProductResponseSchema = CardProductFieldsSchema.extend({
  id: z.string().uuid(),
}).superRefine(validateProductPrice);

export const CardProductsSchema = z
  .array(CardProductSchema)
  .max(MAX_CARD_PRODUCTS, 'Add no more than five products or services.');
export const CardProductCreateSchema = CardProductFieldsSchema.omit({
  sortOrder: true,
}).superRefine(validateProductPrice);
export const CardProductUpdateSchema = CardProductFieldsSchema.omit({ sortOrder: true })
  .partial()
  .superRefine(validateProductPrice)
  .refine(
    (product) => Object.keys(product).length > 0,
    'At least one product or service field is required.',
  );
export const CardProductReorderSchema = z
  .array(z.string().uuid())
  .max(MAX_CARD_PRODUCTS)
  .refine((productIds) => new Set(productIds).size === productIds.length, {
    message: 'Each product or service can appear only once.',
  });

export const CardStatusSchema = z.enum(CARD_STATUSES);
export const CardCreatorSchema = z.enum(CARD_CREATORS);

export const CardSchema = CardDataFieldsSchema.extend({
  id: z.string().uuid(),
  ownerId: z.string().uuid().nullable(),
  status: CardStatusSchema,
  createdBy: CardCreatorSchema,
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  deletedAt: z.string().datetime({ offset: true }).nullable(),
}).superRefine(validateCardPurpose);

export type CardPurpose = z.infer<typeof CardPurposeSchema>;
export type Card = z.infer<typeof CardSchema>;
export type CardData = z.infer<typeof CardDataSchema>;
export type CardProfileData = z.infer<typeof CardProfileDataSchema>;
export type CardOffice = z.infer<typeof CardOfficeSchema>;
export type CardProduct = z.infer<typeof CardProductSchema>;
export type CardProductResponse = z.infer<typeof CardProductResponseSchema>;
