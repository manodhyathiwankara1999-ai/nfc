import { z } from 'zod';
import { CardOfficeSchema, CardProductResponseSchema } from './schemas/cards';
import { PublicProfileApiSchema } from './schemas/public-profile';

export const ProfilePreviewDataSchema = z
  .object({
    profile: PublicProfileApiSchema,
    office: CardOfficeSchema.nullable(),
    products: z.array(CardProductResponseSchema).max(5),
    showProducts: z.boolean(),
  })
  .strict();

export const ProfilePreviewMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('profile-preview-ready') }).strict(),
  z
    .object({
      type: z.literal('profile-preview-data'),
      payload: ProfilePreviewDataSchema,
    })
    .strict(),
  z.object({ type: z.literal('profile-preview-clear') }).strict(),
]);

export type ProfilePreviewData = z.infer<typeof ProfilePreviewDataSchema>;
export type ProfilePreviewMessage = z.infer<typeof ProfilePreviewMessageSchema>;
