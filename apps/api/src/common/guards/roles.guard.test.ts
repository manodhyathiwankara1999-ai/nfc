import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { describe, expect, it, vi } from 'vitest';
import { AdminController } from '../../modules/admin/admin.controller';
import { RolesGuard } from './roles.guard';

function contextFor(role: string): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({
      getRequest: () => ({ user: { id: 'user-id', email: 'user@example.com', role } }),
    }),
  } as ExecutionContext;
}

describe('RolesGuard', () => {
  it('protects super-admin routes from normal users', () => {
    const guard = new RolesGuard(new Reflector());
    const context = (role: Role) =>
      ({
        getHandler: () => AdminController.prototype.overview,
        getClass: () => AdminController,
        switchToHttp: () => ({
          getRequest: () => ({ user: { id: 'user-id', email: 'user@example.com', role } }),
        }),
      }) as ExecutionContext;

    expect(guard.canActivate(context(Role.SUPER_ADMIN))).toBe(true);
    expect(() => guard.canActivate(context(Role.USER))).toThrow(ForbiddenException);
  });

  it('permits a role declared for the route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    expect(new RolesGuard(reflector).canActivate(contextFor('admin'))).toBe(true);
  });

  it('denies users whose role is not declared for the route', () => {
    const reflector = {
      getAllAndOverride: vi.fn().mockReturnValue(['admin']),
    } as unknown as Reflector;
    expect(() => new RolesGuard(reflector).canActivate(contextFor('user'))).toThrow(
      ForbiddenException,
    );
  });
});
