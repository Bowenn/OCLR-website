import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'], channel: process.env.PLAYWRIGHT_CHANNEL || undefined } }, { name: 'mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium', channel: process.env.PLAYWRIGHT_CHANNEL || undefined } }],
  webServer: { command: 'npm start -- --hostname 127.0.0.1 --port 3100', url: 'http://127.0.0.1:3100', reuseExistingServer: false },
});
