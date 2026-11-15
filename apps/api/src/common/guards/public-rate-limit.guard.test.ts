import { HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnvironment } from '../../config/env.schema';
import { InMemoryRateLimiter } from '../utils/in-memory-rate-limiter';
import { PublicRateLimitGuard } from './public-rate-limit.guard';

describe('PublicRateLimitGuard', () => {
  it('limits by a keyed IP hash and returns 429 after the per-IP threshold', async () => {
    const config = { get: vi.fn().mockReturnValue('s'.repeat(32)) };
    const guard = new PublicRateLimitGuard(
      new InMemoryRateLimiter(),
      config as unknown as ConfigService<ApiEnvironment, true>,
    );
    const request = {
      headers: { 'x-forwarded-for': '198.51.100.77' },
      ip: '203.0.113.12',
      method: 'GET',
    } as unknown as Request;
    const context = {
      switchToHttp: () => ({ getRequest: () => request }),
    };

    const key = `public:rate:resolve:${createHmac('sha256', 's'.repeat(32))
      .update(request.ip)
      .digest('hex')}`;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      await expect(guard.canActivate(context as never)).resolves.toBe(true);
    }
    await expect(guard.canActivate(context as never)).rejects.toMatchObject({ status: 429 });
    expect(key).toMatch(/^public:rate:resolve:[a-f0-9]{64}$/);
  });
});
