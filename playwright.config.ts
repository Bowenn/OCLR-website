import { assertTestDatabase } from "./tests/database";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { announcements } from "./tests/fixtures/announcements";
import { edition } from "./tests/fixtures/edition";
import preparedEditions from "./src/content/editions.json" with { type: "json" };
const announcementsPath = join(
  tmpdir(),
  `oclr-e2e-announcements-${process.pid}.json`,
);
const fixturePath = join(tmpdir(), `oclr-e2e-editions-${process.pid}.json`);
const bracketsPath =
  process.env.OCLR_TEST_BRACKETS_FILE ||
  join(tmpdir(), `oclr-e2e-brackets-${process.pid}.json`);
if (process.env.TEST_DATABASE_URL) {
  assertTestDatabase(process.env.TEST_DATABASE_URL);
  process.env.OCLR_TEST_BRACKETS_FILE = bracketsPath;
  process.env.OCLR_BRACKETS_FILE = bracketsPath;
  if (!existsSync(bracketsPath)) writeFileSync(bracketsPath, "[]");
  process.env.OCLR_EDITIONS_FILE = fixturePath;
  writeFileSync(announcementsPath, JSON.stringify(announcements));
  writeFileSync(
    fixturePath,
    JSON.stringify([
      ...preparedEditions.filter((e) => e.slug === "s11"),
      edition,
      {
        ...edition,
        slug: "draft-desktop-test",
        name: "Synthetic desktop draft",
      },
      { ...edition, slug: "draft-mobile-test", name: "Synthetic mobile draft" },
    ]),
  );
}
import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    actionTimeout: 10000,
  },
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
    command: process.env.TEST_DATABASE_URL
      ? "node --import tsx --import ./tests/fixtures/osu-provider.ts node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port 3100"
      : "npm start -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100",
    reuseExistingServer: false,
    env: process.env.TEST_DATABASE_URL
      ? {
          DATABASE_URL: process.env.TEST_DATABASE_URL,
          ADMIN_OSU_IDS: "60001,70001,110001,120001",
          TEST_DATABASE_URL: process.env.TEST_DATABASE_URL,
          OSU_CLIENT_ID: "123",
          OSU_CLIENT_SECRET: "synthetic-browser-provider-secret",
          APP_URL: "http://127.0.0.1:3100",
          OCLR_EDITIONS_FILE: fixturePath,
          OCLR_BRACKETS_FILE: bracketsPath,
          OCLR_ANNOUNCEMENTS_FILE: announcementsPath,
          PRIVACY_CONTACT_EMAIL: "privacy@example.test",
          PRIVACY_RETENTION_NOTICE: "Synthetic isolated browser-test policy.",
        }
      : {},
  },
});
