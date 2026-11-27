import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration for Mèo Nổ.
 * Spins up both the Express/Socket.IO backend (port 3000)
 * and the Vite frontend dev server (port 5173).
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'node server/index.mjs',
      port: 3000,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
    {
      command: 'npm run dev --workspace client',
      port: 5173,
      reuseExistingServer: !process.env.CI,
      timeout: 60 * 1000,
    },
  ],
});
