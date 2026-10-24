import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
test.afterAll(closeDb);
test("244 historical presentation", async ({ page, context }, info) => {
  test.setTimeout(120000);
  const archives = [7, 8, 9, 10].map((n) =>
    historicalArchiveSchema.parse(
      JSON.parse(readFileSync(`docs/imports/s${n}-archive.json`, "utf8")),
    ),
  );
  await seedEditions(
    archives.map((archive, i) => ({
      ...edition,
      slug: `issue-244-s${i + 7}`,
      season: String(i + 7),
      name: `OCLR Season ${i + 7}`,
      status: "completed",
      registration: null,
      archive: { ...archive, editionSlug: `issue-244-s${i + 7}` },
    })),
  );
  await context.addCookies([
    { name: "oclr-locale", value: "en", url: "http://127.0.0.1:3100" },
  ]);

  await page.goto("/tournaments/issue-244-s8/staff");
  await expect(page.locator(".archive-staff section")).toHaveCount(3);
  const referee = page
    .locator(".archive-staff section")
    .filter({
      has: page.getByRole("heading", { name: "Referee", exact: true }),
    });
  await expect(referee.locator("li")).toHaveCount(6);
  await expect(
    page.locator(".archive-staff a[href*='osu.ppy.sh']"),
  ).toHaveCount(0);
  await expect(page.locator(".archive-staff")).toContainText("Sonoboi");
  await expect(page.locator(".archive-staff")).toContainText("Sonoaoi");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: info.outputPath("s8-staff.png"),
    fullPage: true,
  });
});
