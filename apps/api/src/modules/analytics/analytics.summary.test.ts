import { Prisma } from '@prisma/client';
import { describe, expect, it, vi } from 'vitest';
import type { ApiEnvironment } from '../../config/env.schema';
import { PrismaService } from '../../prisma/prisma.service';
import { AnalyticsService } from './analytics.service';

describe('AnalyticsService summaries', () => {
  it('aggregates seeded views and scopes every query through profile ownership', async () => {
    const queries: Prisma.Sql[] = [];
    const prisma = {
      $queryRaw: vi.fn((query: Prisma.Sql) => {
        queries.push(query);
        if (query.sql.includes('"totalViews"')) {
          return Promise.resolve([{ totalViews: 12n, uniqueVisitors: 8n }]);
        }
        if (query.sql.includes('SELECT day, SUM(views)')) {
          return Promise.resolve([
            { day: new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`), views: 3n },
          ]);
        }
        return Promise.resolve([
          { dimension: 'device', value: 'mobile', views: 7n },
          { dimension: 'device', value: 'desktop', views: 5n },
          { dimension: 'referrer', value: 'example.com', views: 4n },
          { dimension: 'country', value: 'US', views: 6n },
        ]);
      }),
    };
    const service = new AnalyticsService(
      prisma as unknown as PrismaService,
      {
        get: vi.fn((key: string) =>
          key === 'ANALYTICS_RAW_RETENTION_DAYS' ? 365 : 's'.repeat(32),
        ),
      } as never,
    );

    const result = await service.getSummary('owner-user-id', '7d');

    expect(result.totalViews).toBe(12);
    expect(result.uniqueVisitors).toBe(8);
    expect(result.viewsPerDay).toHaveLength(7);
    expect(result.viewsPerDay.at(-1)).toMatchObject({ views: 3 });
    expect(result.devices).toEqual([
      { device: 'mobile', views: 7 },
      { device: 'desktop', views: 5 },
    ]);
    expect(result.topReferrers).toEqual([{ host: 'example.com', views: 4 }]);
    expect(result.topCountries).toEqual([{ country: 'US', views: 6 }]);
    expect(queries).toHaveLength(3);
    expect(queries.every((query) => query.sql.includes('"user_id" ='))).toBe(true);
    expect(queries.every((query) => query.values.includes('owner-user-id'))).toBe(true);
    expect(queries[0].sql).toContain('COUNT(DISTINCT visitors.visitor_hash)');
    expect(queries[0].sql).toContain('unnest(d.visitor_hashes)');
    service.onModuleDestroy();
  });

  it('rolls up raw events before pruning them by the configured retention period', async () => {
    const commands: Prisma.Sql[] = [];
    const transaction = {
      $executeRaw: vi.fn((query: Prisma.Sql) => {
        commands.push(query);
        return Promise.resolve(1);
      }),
    };
    const prisma = {
      $transaction: vi.fn((callback: (tx: typeof transaction) => Promise<unknown>) =>
        callback(transaction),
      ),
    };
    const service = new AnalyticsService(
      prisma as unknown as PrismaService,
      {
        get: vi.fn((key: string) =>
          key === 'ANALYTICS_RAW_RETENTION_DAYS' ? 180 : 's'.repeat(32),
        ),
      } as never,
    );

    await service.runNightlyMaintenance();

    expect(commands).toHaveLength(2);
    expect(commands[0].sql).toContain('INSERT INTO "public"."analytics_daily"');
    expect(commands[0].sql).toContain('COUNT(DISTINCT e.hashed_ip)');
    expect(commands[0].sql).toContain('visitor_hashes');
    expect(commands[0].sql).toContain('ON CONFLICT (profile_id, day) DO UPDATE');
    expect(commands[1].sql).toContain('DELETE FROM "public"."analytics_events"');
    expect(commands[1].sql).toContain('created_at < CURRENT_TIMESTAMP');
    expect(commands[1].values).toContain(180);
    service.onModuleDestroy();
  });
});
