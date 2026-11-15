import { createHmac } from 'node:crypto';
import type { Request } from 'express';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnvironment } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService', () => {
  it('does not persist a view when Do-Not-Track is enabled', async () => {
    const create = vi.fn();
    const service = new AnalyticsService(
      { analyticsEvent: { create } } as unknown as PrismaService,
      {
        get: vi.fn((key: string) => (key === 'IP_HASH_SALT' ? 's'.repeat(32) : 365)),
      } as unknown as import('@nestjs/config').ConfigService<ApiEnvironment, true>,
    );
    const request = {
      headers: { dnt: '1', 'user-agent': 'Mozilla/5.0' },
      ip: '203.0.113.20',
    } as Request;

    await service.recordPublicView('profile-id', null, request);

    expect(create).not.toHaveBeenCalled();
  });

  it('persists a view directly with a keyed IP hash and no raw address', async () => {
    const create = vi.fn().mockResolvedValue(undefined);
    const service = new AnalyticsService(
      { analyticsEvent: { create } } as unknown as PrismaService,
      {
        get: vi.fn((key: string) => (key === 'IP_HASH_SALT' ? 's'.repeat(32) : 365)),
      } as unknown as import('@nestjs/config').ConfigService<ApiEnvironment, true>,
    );
    const request = {
      headers: {
        'x-forwarded-for': '203.0.113.20',
        'user-agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/605.1.15',
        'cf-ipcountry': 'us',
        referer: 'https://example.org/source',
      },
      ip: '203.0.113.20',
    } as Request;

    await service.recordPublicView('profile-id', 'card-id', request);

    const event = create.mock.calls[0]?.[0].data as Record<string, unknown>;
    expect(event.hashedIp).toBe(
      createHmac('sha256', 's'.repeat(32)).update('203.0.113.20').digest('hex'),
    );
    expect(JSON.stringify(event)).not.toContain('203.0.113.20');
    expect(event).toMatchObject({
      profileId: 'profile-id',
      cardId: 'card-id',
      type: 'PROFILE_VIEW',
      country: 'US',
      deviceType: 'mobile',
      referrerHost: 'example.org',
    });
    service.onModuleDestroy();
  });
});
