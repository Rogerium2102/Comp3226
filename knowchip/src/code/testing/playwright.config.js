import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  workers: 2,
  retries: 0,
  timeout: 30000,
  expect: { timeout: 8000 },
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'test-results/browser-results.json' }]],
  use: {
    browserName: 'chromium',
    baseURL: 'https://localhost:8443',
    ignoreHTTPSErrors: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || undefined },
  },
  projects: [
    { name: 'third-party-allowed' },
    { name: 'third-party-blocked' },
  ],
  webServer: {
    command: 'node src/server.js',
    url: 'https://localhost:8443/api/health',
    ignoreHTTPSErrors: true,
    reuseExistingServer: false,
    timeout: 20000,
  },
});
