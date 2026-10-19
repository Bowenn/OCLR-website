import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { edition } from "./tests/fixtures/edition";
const fixturePath = join(tmpdir(), `oclr-e2e-editions-${process.pid}.json`);
if (process.env.TEST_DATABASE_URL)
  writeFileSync(fixturePath, JSON.stringify([edition]));
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      },
    },
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        defaultBrowserType: "chromium",
        channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
      },
    },
  ],
  webServer: {
    command: "npm start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: process.env.TEST_DATABASE_URL
      ? {
          DATABASE_URL: process.env.TEST_DATABASE_URL,
          APP_URL: "http://127.0.0.1:3100",
          OCLR_EDITIONS_FILE: fixturePath,
          PRIVACY_CONTACT_EMAIL: "privacy@example.test",
          PRIVACY_RETENTION_NOTICE: "Synthetic isolated browser-test policy.",
        }
      : {},
  },
});
