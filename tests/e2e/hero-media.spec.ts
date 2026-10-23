import { test, expect, type BrowserContext, type Page } from "@playwright/test";
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
  branding: { ...edition.branding, keyVisual: "/oclr-s11-key-visual.webp" },
};
const asset = "**/oclr-s11-key-visual.webp";
async function preferences(
  context: BrowserContext,
  locale: string,
  theme: string,
) {
  await context.addCookies(
    [
      ["oclr-locale", locale],
      ["oclr-theme", theme],
    ].map(([name, value]) => ({ name, value, url: "http://127.0.0.1:3100" })),
  );
}
async function geometry(page: Page) {
  return page.evaluate(() => {
    const rect = (selector: string) =>
      document.querySelector(selector)!.getBoundingClientRect().toJSON();
    const image =
      document.querySelector<HTMLImageElement>(".event-artwork img")!;
    return {
      hero: rect(".season-overview-hero"),
      intro: rect(".event-intro"),
      media: rect(".season-hero-aside"),
      image: rect(".event-artwork img"),
      natural: { width: image.naturalWidth, height: image.naturalHeight },
      fit: getComputedStyle(image).objectFit,
      position: getComputedStyle(image).objectPosition,
      scrollWidth: document.documentElement.scrollWidth,
    };
  });
}
function filled(g: Awaited<ReturnType<typeof geometry>>) {
  for (const edge of ["top", "bottom", "left", "right"] as const)
    expect(g.image[edge], edge).toBeCloseTo(g.media[edge], 0);
  expect(g.media.top).toBeCloseTo(g.hero.top + 1, 0);
  expect(g.media.bottom).toBeCloseTo(g.hero.bottom - 1, 0);
  expect(g.fit).toBe("cover");
}
test.describe("full-height season hero media", () => {
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
  test("fills desktop edges without losing S11 landmarks, and stacks naturally on smaller screens", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const active of [true, false]) {
      await seedEditions([
        { ...hero, registration: active ? edition.registration : null },
      ]);
      for (const locale of ["en", "zh-Hans", "zh-Hant"])
        for (const theme of ["light", "dark"]) {
          await preferences(context, locale, theme);
          for (const width of isMobile
            ? [320, 390]
            : [768, 1024, 1280, 1366, 1440, 1920]) {
            await page.setViewportSize({
              width,
              height: width === 1920 ? 1080 : 900,
            });
            await page.goto("/tournaments/test-cup");
            await expect(page.locator(".event-artwork img")).toBeVisible();
            const g = await geometry(page);
            expect(g.natural.width).toBe(1672);
            expect(g.scrollWidth).toBeLessThanOrEqual(width);
            expect(
              await page.locator(".event-artwork img").getAttribute("alt"),
            ).toContain(hero.name);
            if (width > 1360) {
              filled(g);
              expect(g.media.width / g.hero.width).toBeCloseTo(0.55, 1);
              // Landmarks of the approved S11 source asset; not application crop constants.
              const scale = Math.max(
                g.image.width / g.natural.width,
                g.image.height / g.natural.height,
              );
              const [x, y] = g.position
                .split(" ")
                .map((value) => parseFloat(value) / 100);
              const visible = {
                left: (g.natural.width - g.image.width / scale) * x,
                top: (g.natural.height - g.image.height / scale) * y,
              };
              for (const landmark of [
                { left: 128, top: 250, right: 905, bottom: 432 },
                { left: 1070, top: 80, right: 1320, bottom: 345 },
              ]) {
                expect(visible.left).toBeLessThanOrEqual(landmark.left);
                expect(visible.top).toBeLessThanOrEqual(landmark.top);
                expect(
                  visible.left + g.image.width / scale,
                ).toBeGreaterThanOrEqual(landmark.right);
                expect(
                  visible.top + g.image.height / scale,
                ).toBeGreaterThanOrEqual(landmark.bottom);
              }
            } else {
              expect(g.media.top).toBeGreaterThanOrEqual(g.intro.bottom);
              expect(g.image.width / g.image.height).toBeCloseTo(
                g.natural.width / g.natural.height,
                2,
              );
              expect(g.image.top).toBeCloseTo(g.media.top, 0);
              expect(g.image.bottom).toBeCloseTo(g.media.bottom, 0);
            }
            if ([390, 1440, 1920].includes(width))
              await page.screenshot({
                path: info.outputPath(
                  `after-${active ? "active" : "inactive"}-${locale}-${theme}-${width}.png`,
                ),
                fullPage: true,
                animations: "disabled",
              });
          }
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
        }
    }
    expect(errors).toEqual([]);
  });
  test("handles landscape, square and portrait sources, a broken image and no artwork", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const width = isMobile ? 390 : 1440;
    await page.setViewportSize({ width, height: 900 });
    for (const [w, h] of [
      [1600, 900],
      [800, 800],
      [600, 1000],
    ]) {
      await context.route(asset, (route) =>
        route.fulfill({
          contentType: "image/svg+xml",
          body: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><rect width="100%" height="100%" fill="#33405b"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 4}" fill="#ac8dcc"/></svg>`,
        }),
      );
      await page.goto("/tournaments/test-cup");
      const g = await geometry(page);
      expect(g.natural).toEqual({ width: w, height: h });
      if (isMobile)
        expect(g.image.width / g.image.height).toBeCloseTo(w / h, 2);
      else filled(g);
      await page.screenshot({
        path: info.outputPath(`source-${w}-${h}.png`),
        fullPage: true,
      });
      await context.unroute(asset);
    }
    await context.route(asset, (route) => route.abort());
    await page.goto("/tournaments/test-cup");
    await expect(page.locator(".event-artwork-fallback")).toBeVisible();
    await expect(page.locator(".event-artwork-fallback")).toContainText(
      hero.name,
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (!isMobile) {
      const media = (await page.locator(".season-hero-aside").boundingBox())!;
      const fallback = (await page
        .locator(".event-artwork-fallback")
        .boundingBox())!;
      expect(fallback.height).toBeCloseTo(media.height, 0);
    }
    await page.screenshot({
      path: info.outputPath("broken-artwork.png"),
      fullPage: true,
    });
    await seedEditions([{ ...hero, branding: edition.branding }]);
    await page.goto("/tournaments/test-cup");
    await expect(page.locator(".season-hero-aside")).toHaveCount(0);
    await expect(page.locator(".season-countdown")).toBeVisible();
  });
  test("reserves the approved image space before loading", async ({
    page,
    context,
    isMobile,
  }) => {
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await context.route(asset, async (route) => {
      await gate;
      await route.fulfill({
        path: resolve("public/oclr-s11-key-visual.webp"),
        contentType: "image/webp",
      });
    });
    try {
      await page.goto("/tournaments/test-cup", {
        waitUntil: "domcontentloaded",
      });
      await page.evaluate(() => document.fonts.ready);
      const before = (await page
        .locator(".season-registration")
        .boundingBox())!;
      release();
      await expect
        .poll(() =>
          page
            .locator(".event-artwork img")
            .evaluate((img: HTMLImageElement) => img.naturalWidth),
        )
        .toBe(1672);
      const after = (await page.locator(".season-registration").boundingBox())!;
      expect(after.y).toBeCloseTo(before.y, 0);
    } finally {
      release();
    }
  });
});
