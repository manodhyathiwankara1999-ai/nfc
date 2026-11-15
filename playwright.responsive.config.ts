import { defineConfig } from '@playwright/test';

const baseURL = 'http://127.0.0.1:3101';

export default defineConfig({
  testDir: './apps/web/e2e',
  testMatch: '**/profile-responsive.spec.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  outputDir: './test-results/profile-responsive',
  use: {
    baseURL,
    browserName: 'chromium',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm --filter @nfc/web exec next dev --hostname 127.0.0.1 --port 3101',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
