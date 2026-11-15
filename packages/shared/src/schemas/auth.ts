import { z } from 'zod';
import { RegistrationAccountType } from '../enums';

export const RegisterSchema = z.object({
  displayName: z.string().trim().min(2).max(100),
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(8).max(128),
  accountType: z.nativeEnum(RegistrationAccountType),
});

export const LoginSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
  password: z.string().min(1).max(128),
});

export const EmailTokenSchema = z.object({
  token: z.string().min(32).max(256),
});

export const ForgotPasswordSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .max(320)
    .transform((email) => email.toLowerCase()),
});

export const ResetPasswordSchema = EmailTokenSchema.extend({
  password: z.string().min(8).max(128),
});

export type RegisterInput = z.infer<typeof RegisterSchema>;
export type LoginInput = z.infer<typeof LoginSchema>;
