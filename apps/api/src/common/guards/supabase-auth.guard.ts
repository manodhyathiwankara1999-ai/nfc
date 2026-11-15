import {
  CanActivate,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { AccountType, Role } from '@prisma/client';
import type { Request } from 'express';
import { z } from 'zod';
import { PrismaService } from '../../prisma/prisma.service';
import type { ApiEnvironment } from '../../config/env.schema';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';

const SupabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  email_confirmed_at: z.string().nullable().optional(),
  user_metadata: z.record(z.unknown()).optional(),
});

interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

interface UserIdRow {
  id: string;
}

async function findAccountIdBySupabaseUserId(
  prisma: PrismaService,
  supabaseUserId: string,
): Promise<string | null> {
  const rows = await prisma.$queryRaw<UserIdRow[]>`
    SELECT "id"::text AS "id"
    FROM "public"."users"
    WHERE "supabase_user_id" = ${supabaseUserId}::uuid
    LIMIT 1
  `;
  return rows[0]?.id ?? null;
}

@Injectable()
export class SupabaseAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService<ApiEnvironment, true>,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = /^Bearer\s+(.+)$/i.exec(request.headers.authorization ?? '')?.[1];
    if (!token) throw new UnauthorizedException('Authentication is required.');

    const supabaseUrl = this.config.get('SUPABASE_URL', { infer: true });
    const anonKey = this.config.get('SUPABASE_ANON_KEY', { infer: true });
    let response: Response;
    try {
      response = await fetch(new URL('/auth/v1/user', supabaseUrl), {
        headers: { apikey: anonKey, authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000),
      });
    } catch {
      throw new ServiceUnavailableException('Authentication service is unavailable.');
    }
    if (response.status === 401 || response.status === 403) {
      throw new UnauthorizedException('Authentication is required.');
    }
    if (!response.ok) {
      throw new ServiceUnavailableException('Authentication service is unavailable.');
    }

    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new ServiceUnavailableException('Authentication service is unavailable.');
    }
    const parsedUser = SupabaseUserSchema.safeParse(payload);
    if (!parsedUser.success) {
      throw new UnauthorizedException('Authentication is required.');
    }
    const supabaseUser = parsedUser.data;
    const emailVerifiedAt = supabaseUser.email_confirmed_at
      ? new Date(supabaseUser.email_confirmed_at)
      : undefined;
    if (!emailVerifiedAt || Number.isNaN(emailVerifiedAt.getTime())) {
      throw new UnauthorizedException('Email verification is required.');
    }
    const accountType =
      supabaseUser.user_metadata?.account_type === 'company'
        ? AccountType.COMPANY
        : AccountType.SELF_EMPLOYED;
    const mappedAccountId = await findAccountIdBySupabaseUserId(this.prisma, supabaseUser.id);
    let account = mappedAccountId
      ? await this.prisma.user.findUnique({
          where: { id: mappedAccountId },
          select: {
            id: true,
            email: true,
            role: true,
            accountType: true,
            emailVerifiedAt: true,
            deletedAt: true,
          },
        })
      : null;
    if (!account) {
      const legacyAccount = await this.prisma.user.findUnique({
        where: { email: supabaseUser.email },
        select: {
          id: true,
          email: true,
          role: true,
          accountType: true,
          emailVerifiedAt: true,
          deletedAt: true,
        },
      });
      if (legacyAccount) {
        if (legacyAccount.deletedAt) {
          throw new UnauthorizedException('Authentication is required.');
        }
        const claimedAccount = await this.prisma.$queryRaw<UserIdRow[]>`
          UPDATE "public"."users"
          SET "supabase_user_id" = ${supabaseUser.id}::uuid,
              "email_verified_at" = ${emailVerifiedAt},
              "updated_at" = NOW()
          WHERE "id" = ${legacyAccount.id}::uuid
            AND ("supabase_user_id" IS NULL OR "supabase_user_id" = ${supabaseUser.id}::uuid)
          RETURNING "id"::text AS "id"
        `;
        if (!claimedAccount[0]) {
          throw new UnauthorizedException('Authentication is required.');
        }
        account = { ...legacyAccount, emailVerifiedAt };
      } else {
        const existingId = await this.prisma.user.findUnique({
          where: { id: supabaseUser.id },
          select: {
            id: true,
            email: true,
            role: true,
            accountType: true,
            emailVerifiedAt: true,
            deletedAt: true,
          },
        });
        if (existingId && (existingId.email !== supabaseUser.email || existingId.deletedAt)) {
          throw new UnauthorizedException('Authentication is required.');
        }
        account = await this.prisma.user.upsert({
          where: { id: supabaseUser.id },
          create: {
            id: supabaseUser.id,
            email: supabaseUser.email,
            role: Role.USER,
            accountType,
            emailVerifiedAt,
          },
          update: {
            email: supabaseUser.email,
            emailVerifiedAt,
          },
          select: {
            id: true,
            email: true,
            role: true,
            accountType: true,
            emailVerifiedAt: true,
            deletedAt: true,
          },
        });
        const linkedAccount = await this.prisma.$queryRaw<UserIdRow[]>`
          UPDATE "public"."users"
          SET "supabase_user_id" = ${supabaseUser.id}::uuid,
              "updated_at" = NOW()
          WHERE "id" = ${account.id}::uuid
            AND ("supabase_user_id" IS NULL OR "supabase_user_id" = ${supabaseUser.id}::uuid)
          RETURNING "id"::text AS "id"
        `;
        if (!linkedAccount[0]) {
          throw new UnauthorizedException('Authentication is required.');
        }
        if (account.deletedAt) throw new UnauthorizedException('Authentication is required.');
      }
    }
    if (!account) throw new UnauthorizedException('Authentication is required.');
    if (account.deletedAt) throw new UnauthorizedException('Authentication is required.');

    if (
      account.email !== supabaseUser.email ||
      account.emailVerifiedAt?.getTime() !== emailVerifiedAt.getTime()
    ) {
      account = await this.prisma.user.update({
        where: { id: account.id },
        data: { email: supabaseUser.email, emailVerifiedAt },
        select: {
          id: true,
          email: true,
          role: true,
          accountType: true,
          emailVerifiedAt: true,
          deletedAt: true,
        },
      });
    }

    request.user = {
      id: account.id,
      email: account.email,
      role: account.role,
      accountType: String(account.accountType),
      emailVerified: Boolean(account.emailVerifiedAt),
    };
    return true;
  }
}
