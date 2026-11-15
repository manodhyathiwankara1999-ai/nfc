import { defineConfig } from '@playwright/test';

const requiredEnvironment = [
  'E2E_ADMIN_USERNAME',
  'E2E_ADMIN_PASSWORD',
  'E2E_OWNER_EMAIL',
  'E2E_OWNER_PASSWORD',
];
const e2eConfigured = requiredEnvironment.every((name) => Boolean(process.env[name]));
const baseURL = process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000';
const shouldStartLocalServer = e2eConfigured && !process.env.E2E_BASE_URL;

export default defineConfig({
  testDir: './apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
  },
  ...(shouldStartLocalServer
    ? {
        webServer: {
          command: 'pnpm dev',
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 120_000,
        },
      }
    : {}),
});
