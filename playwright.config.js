import { defineConfig } from '@playwright/test';

const channel = process.env.PLAYWRIGHT_CHANNEL;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: process.env.CI ? 2 : 1,
  reporter: [['list'], ['html', { outputFolder: 'playwright-report', open: 'never' }]],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...(channel ? { channel } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      args: [
        '--enable-unsafe-swiftshader',
        '--disable-gpu-sandbox',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
      ],
    },
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
