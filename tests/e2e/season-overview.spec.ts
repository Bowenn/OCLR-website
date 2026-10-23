import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { teams } from "../../src/db/schema";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { seedPublicDirectory } from "../fixtures/players";
import { seedPublicPolish } from "../fixtures/public-polish";
import { assertTestDatabase } from "../database";
import { seedBrowserEditions } from "./setup";
const season = {
  ...edition,
  slug: "s11",
  season: "11",
  name: "OCLR Season 11",
  summary: "osu! Chinese League Rookie — Season 11.",
  branding: {
    logo: "/oclr-s11-square-logo.webp",
    background: "/oclr-s11-website-background.webp",
    keyVisual: "/oclr-s11-key-visual.webp",
  },
  eligibility:
    "Synthetic eligibility disclosure for responsive review.\nConfigured requirements remain available without crowding the overview.",
  schedule: [
    { label: "Registration", at: "2026-10-01T00:00:00Z" },
    { label: "Captain announcement", at: null },
    { label: "Live draft", at: "2098-11-21T12:00:00Z" },
    { label: "Group Stage", at: null },
    { label: "Knockout Stage", at: null },
    { label: "Final", at: null },
  ],
};
async function preferences(
  context: BrowserContext,
  locale: string,
  theme: string,
) {
  await context.addCookies([
    { name: "oclr-locale", value: locale, url: "http://127.0.0.1:3100" },
    { name: "oclr-theme", value: theme, url: "http://127.0.0.1:3100" },
  ]);
}
test.describe("season overview composition", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([season]);
  });
  test.afterEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);

  test("balances registration, preserves artwork and planned timeline in every locale/theme/width", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"]) {
        await preferences(context, locale, theme);
        for (const width of isMobile ? [320, 390] : [768, 1024, 1440, 1600]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto("/tournaments/s11");
          await expect(page.locator("#event-title")).toHaveText(season.name);
          await expect(
            page.locator(".event-intro > .season-countdown"),
          ).toHaveCount(1);
          await expect(
            page.locator(".season-hero-aside .season-countdown"),
          ).toHaveCount(0);
          await expect(
            page.locator(".season-registration-facts h3"),
          ).toBeVisible();
          const heading = await page
            .locator("#season-registration-heading")
            .boundingBox();
          const badge = await page
            .locator(".season-registration-heading .badge")
            .boundingBox();
          expect(badge!.x - (heading!.x + heading!.width)).toBeLessThanOrEqual(
            16,
          );
          await expect(page.locator(".event-overview-main")).toHaveCount(0);
          await expect(
            page.locator(".season-player-count > strong"),
          ).toHaveText("0");
          await expect(page.locator(".event-milestones > li")).toHaveCount(6);
          await expect(
            page.locator(".event-milestones > li[data-next]"),
          ).toContainText("Live draft");
          await expect(
            page.locator(
              ".event-milestones [aria-current], .event-milestones .completed",
            ),
          ).toHaveCount(0);
          await expect(
            page.locator(".season-registration-facts"),
          ).toContainText("Asia/Taipei");
          expect(
            (
              await page.locator(".season-registration-facts").innerText()
            ).match(/Asia\/Taipei/g),
          ).toHaveLength(1);
          await expect(page.locator(".season-eligibility")).toContainText(
            season.eligibility,
          );
          await expect(page.locator(".event-artwork img")).toHaveCSS(
            "object-fit",
            width <= 1360 ? "contain" : "cover",
          );
          const measured = await page.evaluate(() => {
            const cards = [
              ...document.querySelectorAll(
                ".season-registration-grid > .panel",
              ),
            ].map((el) => el.getBoundingClientRect().toJSON());
            const image =
              document.querySelector<HTMLImageElement>(".event-artwork img")!;
            return {
              documentWidth: document.documentElement.scrollWidth,
              cards,
              intro: document
                .querySelector(".event-intro")!
                .getBoundingClientRect()
                .toJSON(),
              artwork: document
                .querySelector(".season-hero-aside")!
                .getBoundingClientRect()
                .toJSON(),
              units: [
                ...document.querySelectorAll(".countdown-units strong"),
              ].map((el) => el.getBoundingClientRect().toJSON()),
              aspect:
                image.getBoundingClientRect().width /
                image.getBoundingClientRect().height,
              expected: image.naturalWidth / image.naturalHeight,
            };
          });
          expect(measured.documentWidth).toBeLessThanOrEqual(width);
          if (width <= 1360)
            expect(measured.aspect).toBeCloseTo(measured.expected, 1);
          if (width <= 1360)
            expect(measured.artwork.top).toBeGreaterThanOrEqual(
              measured.intro.bottom,
            );
          else
            expect(measured.artwork.left).toBeGreaterThanOrEqual(
              measured.intro.right,
            );
          for (let i = 1; i < measured.units.length; i++)
            expect(measured.units[i].left).toBeGreaterThanOrEqual(
              measured.units[i - 1].right,
            );
          if (width > 760) {
            expect(measured.cards[0].top).toBeCloseTo(measured.cards[1].top, 0);
            expect(measured.cards[0].height).toBeCloseTo(
              measured.cards[1].height,
              1,
            );
            expect(
              measured.cards[0].width / measured.cards[1].width,
            ).toBeCloseTo(1, 1);
          } else
            expect(measured.cards[1].top).toBeGreaterThan(
              measured.cards[0].bottom,
            );
          if (locale === "en" && [390, 1440].includes(width))
            await page.screenshot({
              path: info.outputPath(`overview-${theme}-${width}.png`),
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
    expect(errors).toEqual([]);
    await page.locator(".event-milestones").focus();
    await expect(page.locator(".event-milestones")).toBeFocused();
    await page.screenshot({
      path: info.outputPath("season-overview.png"),
      fullPage: true,
    });
  });

  test("matches registration card heights only while side by side", async ({
    page,
    context,
    isMobile,
  }) => {
    for (const eligibility of [
      null,
      "Short policy",
      "Rank 15000 / PP 8810 · 參賽資格说明。\n".repeat(35),
    ])
      for (const theme of ["light", "dark"]) {
        await seedEditions([{ ...edition, eligibility }]);
        await preferences(context, "en", theme);
        for (const width of isMobile ? [320, 390] : [768, 1024, 1440, 2048]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto("/tournaments/test-cup");
          const left = (await page
            .locator(".season-entry-summary")
            .boundingBox())!;
          const right = (await page
            .locator(".season-registration-facts")
            .boundingBox())!;
          if (width > 760) {
            expect(left.height).toBeCloseTo(right.height, 1);
            expect(left.y + left.height).toBeCloseTo(right.y + right.height, 1);
          } else {
            expect(right.y).toBeGreaterThan(left.y + left.height);
            if (eligibility && eligibility.length > 100)
              expect(left.height).toBeGreaterThan(right.height);
          }
          for (const row of await page
            .locator(".season-registration-facts .detail-list > div")
            .all())
            expect((await row.boundingBox())!.height).toBeLessThan(120);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
        }
      }
  });

  test("counts only public accepted players and adapts to zero, one and three published teams", async ({
    page,
  }) => {
    await seedEditions([edition]);
    await page.goto("/tournaments/test-cup");
    await expect(page.locator(".event-overview-grid")).toHaveCount(0);
    for (let i = 0; i < 3; i++) {
      await seedPublicDirectory(970000 + i * 10);
      await page.reload();
      await expect(page.locator(".season-player-count > strong")).toHaveText(
        String((i + 1) * 3),
      );
      await expect(page.locator(".event-team-links > li")).toHaveCount(i + 1);
      await expect(page.locator(".event-overview-main")).toHaveCount(0);
      await expect(page.locator(".event-overview-grid")).toHaveClass(
        /teams-only/,
      );
      if (i === 0)
        await expect(page.locator(".event-overview-grid")).toHaveClass(
          /single-team/,
        );
    }
    await expect(page.locator("main")).not.toContainText(
      /PRIVATE_CONTACT|INTERNAL_REASON|Private Applicant|Unpublished Captain/,
    );
    await db().update(teams).set({ identityPublished: false });
    await page.reload();
    await expect(page.locator(".event-overview-grid")).toHaveCount(0);
    expect((await page.goto("/tournaments/private-test-cup"))?.status()).toBe(
      404,
    );
    await seedEditions([{ ...edition, published: false }]);
    expect((await page.goto("/tournaments/test-cup"))?.status()).toBe(404);
  });

  test("shows a compact single panel without registration configuration and retains real competition content", async ({
    page,
  }) => {
    await seedEditions([
      {
        ...edition,
        registration: null,
        rules: null,
        eligibility: null,
        schedule: [],
      },
    ]);
    await page.goto("/tournaments/test-cup");
    await expect(
      page.locator(".season-registration-grid > .panel"),
    ).toHaveCount(1);
    await expect(
      page.locator(
        ".season-player-count,.countdown-units,.season-stages,.event-overview-grid",
      ),
    ).toHaveCount(0);
    expect(
      (await page.locator(".season-registration-grid").boundingBox())!.width,
    ).toBeLessThanOrEqual(768);
    const disclosure =
      "Eligibility disclosure.\n" + "UnbrokenAuthoredText".repeat(150);
    await seedEditions([
      { ...edition, eligibility: disclosure, registration: null },
    ]);
    await page.reload();
    await expect(page.locator(".season-eligibility")).toContainText(disclosure);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await seedPublicPolish(60001, 970999, 971000);
    await page.reload();
    await expect(page.locator(".event-overview-main")).toBeVisible();
    await expect(
      page.locator("#upcoming-heading,#latest-heading").first(),
    ).toBeVisible();
    await expect(page.locator(".event-pool-list > li")).not.toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });

  test("transitions countdown with server authorization at opening/closing and hides it when disabled", async ({
    page,
    context,
  }) => {
    await preferences(context, "en", "light");
    const now = Date.now();
    const opensAt = new Date(now + 4_000).toISOString(),
      closesAt = new Date(now + 8_000).toISOString();
    await seedEditions([
      {
        ...edition,
        registration: { ...edition.registration!, opensAt, closesAt },
      },
    ]);
    await page.goto("/tournaments/test-cup");
    await expect(page.locator(".season-countdown")).toContainText(
      "Registration opens in",
    );
    await expect(page.locator(".countdown-window progress")).toHaveAttribute(
      "value",
      "0",
    );
    await expect(page.locator(".season-countdown")).toContainText(
      "Registration closes in",
      { timeout: 12000 },
    );
    await expect(
      page.locator('.event-intro a[href$="/register"]'),
    ).toBeVisible();
    await expect(page.locator(".season-countdown")).toContainText(
      "Registration closed",
      { timeout: 12000 },
    );
    await expect(page.locator('.event-intro a[href$="/register"]')).toHaveCount(
      0,
    );
    await expect(page.locator(".countdown-units")).toHaveCount(0);
    await seedEditions([
      {
        ...edition,
        registration: { ...edition.registration!, enabled: false },
      },
    ]);
    await page.goto("/tournaments/test-cup");
    await expect(page.locator(".countdown-units")).toHaveCount(0);
    await expect(page.locator(".season-countdown")).toContainText(
      "Registration paused",
    );
    await seedEditions([
      {
        ...edition,
        registration: {
          ...edition.registration!,
          opensAt: "2020-01-01T00:00:00Z",
          closesAt: "2020-02-01T00:00:00Z",
        },
      },
    ]);
    await page.goto("/tournaments/test-cup");
    await expect(page.locator(".season-countdown")).toContainText(
      "Registration closed",
    );
    await expect(page.locator(".countdown-units")).toHaveCount(0);
  });
});
