import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { assertTestDatabase } from "../database";
import { edition } from "../fixtures/edition";
import { seedEditions } from "../fixtures/editions";
import { seedBrowserEditions } from "./setup";

async function showMenu(page: Page) {
  if (await page.locator(".menu-toggle").isVisible())
    await page.locator(".menu-toggle").click();
  await page.locator(".tournament-menu-trigger").click();
}

test.describe("compact published tournament navigation", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([
      { ...edition, name: "OCLR Season 11", season: "11" },
      {
        ...edition,
        slug: "private-menu-test",
        name: "PRIVATE",
        published: false,
      },
    ]);
  });
  test.afterEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);

  test("aligns compact rows across viewport, language and theme", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    let requests = 0;
    page.on("request", (request) => {
      if (request.url().endsWith("/api/tournaments?navigation=1")) requests++;
    });
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"])
        for (const width of isMobile ? [320, 390, 768] : [1280, 1440]) {
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
          const before = requests;
          await page.setViewportSize({ width, height: 900 });
          await page.goto("/");
          expect(requests).toBe(before);
          await showMenu(page);
          const dropdown = page.locator(".tournament-dropdown");
          await expect(
            dropdown.getByRole("link", { name: "OCLR Season 11", exact: true }),
          ).toBeVisible();
          await expect(dropdown.getByRole("link")).toHaveCount(2);
          expect(requests).toBe(before + 1);
          await expect(dropdown).not.toContainText("PRIVATE");
          await expect(
            page.locator(".tournament-dropdown-all"),
          ).not.toContainText("→");
          await expect(page.locator(".tournament-dropdown-all")).toHaveCSS(
            "border-top-width",
            "1px",
          );
          const box = (await dropdown.boundingBox())!;
          expect(box.x).toBeGreaterThanOrEqual(0);
          expect(box.x + box.width).toBeLessThanOrEqual(width);
          for (const link of await dropdown.getByRole("link").all())
            expect((await link.boundingBox())!.height).toBeGreaterThanOrEqual(
              44,
            );
          await expect(page.locator(".tournament-menu-trigger")).toHaveCSS(
            "background-color",
            "rgba(0, 0, 0, 0)",
          );
          await expect(
            page.locator(".tournament-menu-trigger svg"),
          ).toHaveCount(1);
          if (width > 950) {
            expect(box.width).toBeLessThanOrEqual(288);
            expect(box.height).toBeLessThanOrEqual(110);
            const alignment = await page.evaluate(() => {
              function center(selector: string) {
                const range = document.createRange();
                range.selectNodeContents(document.querySelector(selector)!);
                const box = range.getBoundingClientRect();
                return box.y + box.height / 2;
              }
              return Math.abs(
                center(".main-nav > a") -
                  center(".tournament-menu-heading > a"),
              );
            });
            expect(alignment).toBeLessThanOrEqual(2);
            const heading = (await page
              .locator(".tournament-menu-heading")
              .boundingBox())!;
            expect(box.y - heading.y - heading.height).toBeCloseTo(8, 0);
          } else {
            await expect(dropdown).toHaveCSS("position", "static");
            const news = (await page
              .locator('.main-nav > a[href="/news"]')
              .boundingBox())!;
            expect(news.y).toBeGreaterThanOrEqual(box.y + box.height);
          }
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          await page.screenshot({
            path: info.outputPath(`${width}-${locale}-${theme}.png`),
          });
          if (width === (isMobile ? 390 : 1440)) {
            const scan = await new AxeBuilder({ page })
              .include(".site-header")
              .analyze();
            expect(scan.violations).toEqual([]);
          }
        }
  });

  test("fits zero, three and ten public editions, with bounded scrolling", async ({
    page,
    isMobile,
  }, info) => {
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
    for (const count of [0, 3, 10]) {
      await db().execute(
        sql`UPDATE edition_state SET configuration = jsonb_set(configuration, '{published}', 'false')`,
      );
      await seedEditions(
        Array.from({ length: count }, (_, i) => ({
          ...edition,
          slug: `menu-${i}`,
          name: `Synthetic season ${i + 1}`,
        })),
      );
      await page.goto("/");
      await showMenu(page);
      const list = page.locator(".tournament-dropdown-list");
      await expect(list.locator("p[role=status]")).toHaveCount(0);
      await expect(list.getByRole("link")).toHaveCount(count);
      await expect(page.locator(".tournament-dropdown")).not.toContainText(
        "PRIVATE",
      );
      if (!count)
        await expect(list.locator("p")).toContainText(
          "No tournaments published yet",
        );
      if (count === 10) {
        expect(
          await list.evaluate((node) => node.scrollHeight > node.clientHeight),
        ).toBe(true);
        await list.getByRole("link").last().focus();
        expect(await list.evaluate((node) => node.scrollTop)).toBeGreaterThan(
          0,
        );
      }
      const box = (await page.locator(".tournament-dropdown").boundingBox())!;
      expect(box.height).toBeLessThanOrEqual(count < 4 ? 210 : 420);
      await page.screenshot({
        path: info.outputPath(`${count}-published.png`),
      });
      await page.keyboard.press("Escape");
    }
  });

  test("supports native keyboard, touch, dismissal, navigation and active state", async ({
    page,
    isMobile,
  }) => {
    await page.goto("/");
    if (isMobile) await page.locator(".menu-toggle").tap();
    const trigger = page.locator(".tournament-menu-trigger");
    const dropdown = page.locator(".tournament-dropdown");
    await trigger.focus();
    await page.keyboard.press("Enter");
    const link = dropdown.getByRole("link", {
      name: "OCLR Season 11",
      exact: true,
    });
    await expect(link).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(link).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.locator(".tournament-dropdown-all")).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(dropdown).toHaveCount(0);
    await trigger.focus();
    await page.keyboard.press("Space");
    await expect(link).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dropdown).toHaveCount(0);
    await expect(trigger).toBeFocused();
    if (isMobile) await trigger.tap();
    else {
      const before = (await trigger.boundingBox())!;
      await trigger.hover();
      expect(await trigger.boundingBox()).toEqual(before);
      await trigger.click();
    }
    await expect(link).toBeVisible();
    await page.mouse.click(2, 895);
    await expect(dropdown).toHaveCount(0);
    await trigger.click();
    await link.click();
    await expect(page).toHaveURL(/\/tournaments\/test-cup$/);
    await expect(dropdown).toHaveCount(0);
    if (isMobile) {
      await expect(page.locator(".main-nav")).not.toBeVisible();
      await page.locator(".menu-toggle").tap();
    }
    await expect(page.locator(".tournament-menu-heading > a")).toHaveAttribute(
      "aria-current",
      "page",
    );
    await trigger.click();
    await expect(link).toHaveAttribute("aria-current", "page");
    await page.locator(".tournament-dropdown-all").click();
    await expect(page).toHaveURL(/\/tournaments$/);
    await expect(dropdown).toHaveCount(0);
  });

  test("keeps loading and errors compact and safely refreshes after cancellation", async ({
    page,
  }) => {
    let calls = 0;
    await page.route("**/api/tournaments?navigation=1", async (route) => {
      const call = ++calls;
      if (call === 1) await new Promise((resolve) => setTimeout(resolve, 250));
      await route.fulfill(
        call === 2
          ? { status: 503, body: "unavailable" }
          : {
              json: [
                {
                  slug: "test-cup",
                  name: call === 1 ? "Stale response" : "Fresh edition",
                  season: null,
                },
              ],
            },
      );
    });
    await page.goto("/");
    await showMenu(page);
    await expect(page.locator(".tournament-dropdown [role=status]")).toHaveText(
      "Loading…",
    );
    await page.keyboard.press("Escape");
    await page.locator(".tournament-menu-trigger").click();
    await expect(page.locator(".tournament-dropdown [role=status]")).toHaveText(
      "Unable to load tournaments.",
    );
    await expect(page.locator(".tournament-dropdown-all")).toBeVisible();
    await expect(page.locator(".tournament-dropdown")).not.toContainText(
      "Stale response",
    );
    await page.keyboard.press("Escape");
    await page.locator(".tournament-menu-trigger").click();
    await expect(page.locator(".tournament-dropdown-list a")).toHaveText(
      "Fresh edition",
    );
    expect(calls).toBe(3);
  });
});
