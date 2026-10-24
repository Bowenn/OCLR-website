import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
test.afterAll(closeDb);
test("242 historical presentation", async ({ page, context }, info) => {
  test.setTimeout(120000);
  const archives = [7, 8, 9, 10].map((n) =>
    historicalArchiveSchema.parse(
      JSON.parse(readFileSync(`docs/imports/s${n}-archive.json`, "utf8")),
    ),
  );
  await seedEditions(
    archives.map((archive, i) => ({
      ...edition,
      slug: `issue-242-s${i + 7}`,
      season: String(i + 7),
      name: `OCLR Season ${i + 7}`,
      status: "completed",
      registration: null,
      archive: { ...archive, editionSlug: `issue-242-s${i + 7}` },
    })),
  );
  await context.addCookies([
    { name: "oclr-locale", value: "en", url: "http://127.0.0.1:3100" },
  ]);

  for (const season of [8, 9, 10]) {
    await page.goto(`/tournaments/issue-242-s${season}/schedule`);
    const links = page.locator(".event-match-summary td:first-child a");
    expect(await links.count()).toBeGreaterThan(0);
    await expect(links.first()).toHaveAttribute(
      "href",
      new RegExp(`/tournaments/issue-242-s${season}/mappools/`),
    );
    await page.screenshot({
      path: info.outputPath(`s${season}-pool-links.png`),
      fullPage: false,
    });
    await links.first().click();
    await expect(page.locator(".archive-pool-page")).toBeVisible();
  }
});
