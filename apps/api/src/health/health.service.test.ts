import { Test, type TestingModule } from '@nestjs/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PrismaService } from '../prisma/prisma.service';
import { HealthService } from './health.service';

describe('HealthService', () => {
  let testingModule: TestingModule | undefined;
  const queryRaw = vi.fn();

  afterEach(async () => {
    vi.resetAllMocks();
    await testingModule?.close();
  });

  async function createHealthService(): Promise<HealthService> {
    testingModule = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: { $queryRaw: queryRaw } }],
    }).compile();
    return testingModule.get(HealthService);
  }

  it('reports ready when PostgreSQL responds', async () => {
    queryRaw.mockResolvedValue([]);

    await expect((await createHealthService()).check()).resolves.toEqual({
      status: 'ok',
      database: 'ok',
    });
  });

  it('reports unavailable readiness when PostgreSQL fails', async () => {
    queryRaw.mockRejectedValue(new Error('database offline'));

    await expect((await createHealthService()).check()).resolves.toEqual({
      status: 'error',
      database: 'error',
    });
  });
});
