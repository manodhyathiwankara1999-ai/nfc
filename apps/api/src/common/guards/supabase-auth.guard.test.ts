import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { SupabaseAuthGuard } from './supabase-auth.guard';
import type { AuthenticatedUser } from '../decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

const supabaseUserId = 'd82a44c4-10e2-4f6b-bdad-c8346041ca95';

interface GuardDependencies {
  queryRaw?: ReturnType<typeof vi.fn>;
  accountByEmail?: ReturnType<typeof vi.fn>;
  accountById?: ReturnType<typeof vi.fn>;
  userUpsert?: ReturnType<typeof vi.fn>;
}

function makeGuard({
  queryRaw = vi.fn().mockResolvedValue([{ id: supabaseUserId }]),
  accountByEmail = vi.fn().mockResolvedValue(null),
  accountById = vi.fn().mockResolvedValue(null),
  userUpsert = vi.fn(),
}: GuardDependencies = {}) {
  const config = { get: () => 'https://project.supabase.co' };
  const prisma = {
    $queryRaw: queryRaw,
    user: {
      findUnique: vi.fn((query: { where: Record<string, string> }) =>
        query.where.email ? accountByEmail() : accountById(),
      ),
      upsert: userUpsert,
    },
  };
  const reflector = { getAllAndOverride: () => false };
  return new SupabaseAuthGuard(
    reflector as unknown as Reflector,
    config as unknown as ConfigService,
    prisma as unknown as PrismaService,
  );
}

function makeContext(request: Request & { user?: AuthenticatedUser }): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

function stubSupabaseUser(emailConfirmedAt: string | null = '2026-01-01T00:00:00Z') {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: supabaseUserId,
          email: 'person@example.com',
          email_confirmed_at: emailConfirmedAt,
          user_metadata: { account_type: 'company', role: 'SUPER_ADMIN' },
        }),
        { status: 200 },
      ),
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('SupabaseAuthGuard', () => {
  it('validates the token and loads the API role by Supabase user ID', async () => {
    const request = { headers: { authorization: 'Bearer test-token' } } as Request & {
      user?: AuthenticatedUser;
    };
    const account = {
      id: supabaseUserId,
      email: 'person@example.com',
      role: 'ADMIN',
      accountType: 'COMPANY',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    stubSupabaseUser();

    await expect(
      makeGuard({ accountById: vi.fn().mockResolvedValue(account) }).canActivate(
        makeContext(request),
      ),
    ).resolves.toBe(true);
    expect(request.user).toEqual({
      id: supabaseUserId,
      email: 'person@example.com',
      role: 'ADMIN',
      accountType: 'COMPANY',
      emailVerified: true,
    });
  });

  it('attaches a verified Supabase identity to its legacy API account without changing its ID', async () => {
    const request = { headers: { authorization: 'Bearer test-token' } } as Request & {
      user?: AuthenticatedUser;
    };
    const legacyId = 'a2d4c3c0-71d1-4b18-83d0-8b96db2da5b9';
    const legacyAccount = {
      id: legacyId,
      email: 'person@example.com',
      role: 'USER',
      accountType: 'SELF_EMPLOYED',
      emailVerifiedAt: null,
      deletedAt: null,
    };
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: legacyId }]);
    stubSupabaseUser();

    await expect(
      makeGuard({
        queryRaw,
        accountByEmail: vi.fn().mockResolvedValue(legacyAccount),
      }).canActivate(makeContext(request)),
    ).resolves.toBe(true);
    expect(queryRaw).toHaveBeenCalledTimes(2);
    expect(request.user?.id).toBe(legacyId);
    expect(request.user?.role).toBe('USER');
    expect(request.user?.emailVerified).toBe(true);
  });

  it('rejects linking a legacy account already mapped to another identity', async () => {
    const request = { headers: { authorization: 'Bearer test-token' } } as Request & {
      user?: AuthenticatedUser;
    };
    const queryRaw = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    stubSupabaseUser();

    await expect(
      makeGuard({
        queryRaw,
        accountByEmail: vi.fn().mockResolvedValue({
          id: 'a2d4c3c0-71d1-4b18-83d0-8b96db2da5b9',
          email: 'person@example.com',
          role: 'USER',
          accountType: 'SELF_EMPLOYED',
          emailVerifiedAt: null,
          deletedAt: null,
        }),
      }).canActivate(makeContext(request)),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('creates a mapped API account when no legacy account exists', async () => {
    const request = { headers: { authorization: 'Bearer test-token' } } as Request & {
      user?: AuthenticatedUser;
    };
    const account = {
      id: supabaseUserId,
      email: 'person@example.com',
      role: 'USER',
      accountType: 'COMPANY',
      emailVerifiedAt: new Date('2026-01-01T00:00:00Z'),
      deletedAt: null,
    };
    const queryRaw = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: supabaseUserId }]);
    const userUpsert = vi.fn().mockResolvedValue(account);
    stubSupabaseUser();

    await expect(
      makeGuard({ queryRaw, userUpsert }).canActivate(makeContext(request)),
    ).resolves.toBe(true);
    expect(userUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: supabaseUserId },
        create: expect.objectContaining({
          id: supabaseUserId,
          role: 'USER',
          accountType: 'COMPANY',
        }),
      }),
    );
    expect(request.user?.role).toBe('USER');
  });

  it('rejects an unverified Supabase user', async () => {
    const request = { headers: { authorization: 'Bearer test-token' } } as Request & {
      user?: AuthenticatedUser;
    };
    stubSupabaseUser(null);

    await expect(makeGuard().canActivate(makeContext(request))).rejects.toMatchObject({
      status: 401,
    });
  });

  it('rejects requests without a bearer token', async () => {
    const request = { headers: {} } as Request & { user?: AuthenticatedUser };
    await expect(makeGuard().canActivate(makeContext(request))).rejects.toMatchObject({
      status: 401,
    });
  });
});
