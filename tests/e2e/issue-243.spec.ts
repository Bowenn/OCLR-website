import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import { closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
test.afterAll(closeDb);
test("243 historical presentation", async ({ page, context }, info) => {
  test.setTimeout(120000);
  const archives = [7, 8, 9, 10].map((n) =>
    historicalArchiveSchema.parse(
      JSON.parse(readFileSync(`docs/imports/s${n}-archive.json`, "utf8")),
    ),
  );
  await seedEditions(
    archives.map((archive, i) => ({
      ...edition,
      slug: `issue-243-s${i + 7}`,
      season: String(i + 7),
      name: `OCLR Season ${i + 7}`,
      status: "completed",
      registration: null,
      archive: { ...archive, editionSlug: `issue-243-s${i + 7}` },
    })),
  );
  await context.addCookies([
    { name: "oclr-locale", value: "en", url: "http://127.0.0.1:3100" },
  ]);

  for (const theme of ["light", "dark"])
    for (const appearance of ["default", "cute-pastel", "swiss-minimal"]) {
      await context.addCookies(
        [
          ["oclr-theme", theme],
          ["oclr-appearance", appearance],
        ].map(([name, value]) => ({
          name,
          value,
          url: "http://127.0.0.1:3100",
        })),
      );
      const heights: number[] = [];
      for (const season of [7, 8, 9, 10]) {
        await page.goto(`/tournaments/issue-243-s${season}`);
        const frame = page.locator(".archive-key-visual");
        await expect(frame.locator("img")).toHaveAttribute(
          "src",
          new RegExp(`/archive/s${season}/`),
        );
        await expect(frame.locator("img")).toHaveJSProperty("complete", true);
        const box = await frame.boundingBox();
        expect(box).not.toBeNull();
        heights.push(box!.height);
        expect(box!.height).toBeLessThanOrEqual(
          page.viewportSize()!.height / 2 + 1,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        if (appearance === "default")
          await page.screenshot({
            path: info.outputPath(`s${season}-${theme}.png`),
            fullPage: false,
          });
      }
      expect(Math.max(...heights) - Math.min(...heights)).toBeLessThan(2);
    }
});
