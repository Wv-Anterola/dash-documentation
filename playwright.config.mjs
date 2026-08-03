import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  timeout: 30_000,
  globalSetup: './tests/e2e/global-server.mjs',
  use: {
    baseURL: 'http://127.0.0.1:4321/',
    trace: 'retain-on-failure',
  },
});
