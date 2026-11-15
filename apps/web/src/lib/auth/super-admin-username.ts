import { z } from 'zod';

export const SuperAdminUsernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/)
  .transform((username) => username.toLowerCase());

export function superAdminEmailForUsername(username: string): string {
  return `super-admin.${SuperAdminUsernameSchema.parse(username)}@internal.nfc-ecard.invalid`;
}
