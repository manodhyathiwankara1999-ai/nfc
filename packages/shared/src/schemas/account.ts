import { z } from 'zod';

export const AccountDetailsSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  role: z.string(),
  accountType: z.string(),
});

export const AccountDetailsUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100),
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
      .optional()
      .transform((value) => (value === '' ? null : value)),
  })
  .strict();

export type AccountDetails = z.infer<typeof AccountDetailsSchema>;
export type AccountDetailsUpdate = z.input<typeof AccountDetailsUpdateSchema>;
