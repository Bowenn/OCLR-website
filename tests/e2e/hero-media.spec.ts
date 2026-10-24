import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { resolve } from "node:path";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { assertTestDatabase } from "../database";
import { seedBrowserEditions } from "./setup";
const hero = {
  ...edition,
  name: "OCLR Season 11",
  summary: "osu! Chinese League Rookie — Season 11.",
  branding: {
    ...edition.branding,
    background: "/oclr-s11-website-background.webp",
  },
};
test.describe("season information banner media", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([hero]);
  });
  test.afterEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);
  test("information banner stays within the document in every locale and theme", async ({
    page,
    context,
    isMobile,
  }) => {
    test.setTimeout(120000);
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"]) {
        await context.addCookies([
          { name: "oclr-locale", value: locale, url: "http://127.0.0.1:3100" },
          { name: "oclr-theme", value: theme, url: "http://127.0.0.1:3100" },
        ]);
        for (const width of isMobile ? [320, 390] : [768, 1440, 1920]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto("/tournaments/test-cup");
          await expect(page.locator(".information-banner img")).toBeVisible();
          await expect(page.locator("#information-title")).toHaveText(
            hero.name,
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
      }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("loads the authored banner and retains a readable title if it fails", async ({
    page,
    context,
  }) => {
    await context.route("**/oclr-s11-website-background.webp", (route) =>
      route.abort(),
    );
    await page.goto("/tournaments/test-cup");
    await expect(page.locator("#information-title")).toHaveText(hero.name);
    await expect(page.locator(".information-banner img")).toHaveAttribute(
      "src",
      hero.branding.background,
    );
    await expect(page.locator(".stage-scroll")).toBeVisible();
    await seedEditions([{ ...hero, branding: edition.branding }]);
    await page.reload();
    await expect(page.locator(".information-banner")).toHaveCount(0);
    await expect(page.locator("#information-title")).toHaveText(hero.name);
  });
  test("reserves banner space while its image is loading", async ({
    page,
    context,
  }) => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await context.route(
      "**/oclr-s11-website-background.webp",
      async (route) => {
        await gate;
        await route.fulfill({
          path: resolve("public/oclr-s11-website-background.webp"),
          contentType: "image/webp",
        });
      },
    );
    try {
      await page.goto("/tournaments/test-cup", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => document.fonts.ready);
      const before = (await page.locator(".stage-scroll").boundingBox())!;
      release();
      await expect
        .poll(() =>
          page
            .locator(".information-banner img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBeGreaterThan(0);
      const after = (await page.locator(".stage-scroll").boundingBox())!;
      expect(after.y).toBeCloseTo(before.y, 0);
    } finally {
      release();
    }
  });
});
