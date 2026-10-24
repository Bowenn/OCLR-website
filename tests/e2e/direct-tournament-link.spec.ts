import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { assertTestDatabase } from "../database";
test.afterAll(closeDb);
test("header tournaments is one direct link with no chooser fetch", async ({
  page,
  context,
  isMobile,
}, info) => {
  test.setTimeout(90000);
  assertTestDatabase(process.env.TEST_DATABASE_URL);
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
  await seedEditions([
    edition,
    {
      ...edition,
      slug: "private-link-test",
      name: "PRIVATE LINK",
      published: false,
    },
  ]);
  const requests: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("navigation=1")) requests.push(request.url());
  });
  for (const locale of ["en", "zh-Hans", "zh-Hant"])
    for (const theme of ["light", "dark"]) {
      await context.addCookies(
        [
          ["oclr-locale", locale],
          ["oclr-theme", theme],
        ].map(([name, value]) => ({
          name,
          value,
          domain: "127.0.0.1",
          path: "/",
        })),
      );
      for (const width of isMobile ? [320, 390] : [768, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        for (const route of ["/", "/news", "/about", "/tournaments/test-cup"]) {
          await page.goto(route);
          if (width <= 950) await page.locator(".menu-toggle").click();
          const link = page.locator(
            '.main-nav > a[href="/tournaments/test-cup"]',
          );
          await expect(link).toHaveCount(1);
          await expect(
            page.locator(".tournament-menu-trigger, .tournament-dropdown"),
          ).toHaveCount(0);
          if (route.startsWith("/tournaments/"))
            await expect(link).toHaveAttribute("aria-current", "page");
          await link.focus();
          await page.keyboard.press("Enter");
          await expect(page).toHaveURL(/\/tournaments\/test-cup$/);
          if (width <= 950)
            await expect(page.locator(".main-nav")).not.toBeVisible();
          await expect(link).toHaveAttribute("aria-current", "page");
        }
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: info.outputPath(`${width}-${locale}-${theme}.png`),
        });
      }
      expect(
        (await new AxeBuilder({ page }).include(".site-header").analyze())
          .violations,
      ).toEqual([]);
    }
  expect(requests).toEqual([]);
});
