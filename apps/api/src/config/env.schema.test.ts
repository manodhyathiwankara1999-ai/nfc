import { describe, expect, it } from 'vitest';
import { EnvironmentSchema, validateEnvironment } from './env.schema';

const validEnvironment = {
  NODE_ENV: 'test',
  PORT: '4000',
  DATABASE_URL: 'postgresql://localhost:6543/db?pgbouncer=true&connection_limit=1',
  DIRECT_URL: 'postgresql://localhost:5432/db',
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_ANON_KEY: 'test-anon-key',
  CORS_ORIGINS: 'http://localhost:3000,https://ecard.example',
  REVALIDATION_SECRET: 'd'.repeat(32),
  TRUSTED_PROXY_IPS: '127.0.0.1,10.0.0.0/8',
  IP_HASH_SALT: 'c'.repeat(32),
};

describe('API environment validation', () => {
  it('accepts required database, Supabase, and origin settings without optional integrations', () => {
    const result = EnvironmentSchema.safeParse(validEnvironment);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.MAX_CARDS_PER_USER).toBe(5);
  });

  it('accepts a configured per-user card limit and rejects an out-of-range limit', () => {
    expect(
      EnvironmentSchema.safeParse({ ...validEnvironment, MAX_CARDS_PER_USER: '8' }).success,
    ).toBe(true);
    expect(
      EnvironmentSchema.safeParse({ ...validEnvironment, MAX_CARDS_PER_USER: '0' }).success,
    ).toBe(false);
  });

  it('does not expose super-admin seed credentials through runtime API configuration', () => {
    const result = EnvironmentSchema.safeParse({
      ...validEnvironment,
      SUPER_ADMIN_USERNAME: '',
      SUPER_ADMIN_PASSWORD: '',
      SUPABASE_SERVICE_ROLE_KEY: '',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).not.toHaveProperty('SUPER_ADMIN_USERNAME');
      expect(result.data).not.toHaveProperty('SUPER_ADMIN_PASSWORD');
      expect(result.data).not.toHaveProperty('SUPABASE_SERVICE_ROLE_KEY');
    }
  });

  it('rejects partially configured optional integrations', () => {
    expect(
      EnvironmentSchema.safeParse({
        ...validEnvironment,
        R2_ACCOUNT_ID: 'account',
      }).success,
    ).toBe(false);
  });

  it('accepts a fully configured R2 integration', () => {
    expect(
      EnvironmentSchema.safeParse({
        ...validEnvironment,
        R2_ACCOUNT_ID: 'account',
        R2_ACCESS_KEY_ID: 'key',
        R2_SECRET_ACCESS_KEY: 'secret',
        R2_BUCKET_NAME: 'bucket',
        R2_PUBLIC_BASE_URL: 'https://cdn.example.com',
      }).success,
    ).toBe(true);
  });

  it('rejects transaction URLs that do not use the required Supabase pooler settings', () => {
    expect(
      EnvironmentSchema.safeParse({
        ...validEnvironment,
        DATABASE_URL: 'postgresql://localhost:5432/db',
      }).success,
    ).toBe(false);
  });

  it('rejects CORS entries that are not bare HTTP origins', () => {
    expect(
      EnvironmentSchema.safeParse({
        ...validEnvironment,
        CORS_ORIGINS: 'https://ecard.example/path',
      }).success,
    ).toBe(false);
  });

  it('rejects malformed trusted proxy entries', () => {
    expect(
      EnvironmentSchema.safeParse({
        ...validEnvironment,
        TRUSTED_PROXY_IPS: '127.0.0.1,not-an-ip',
      }).success,
    ).toBe(false);
  });

  it('reports invalid variable names without including configured values', () => {
    let message = '';
    try {
      validateEnvironment({
        ...validEnvironment,
        SUPABASE_URL: 'not-a-url',
      });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }

    expect(message).toContain('SUPABASE_URL');
    expect(message).not.toContain('not-a-url');
  });
});
