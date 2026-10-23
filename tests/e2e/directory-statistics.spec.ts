import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { registrations, users, userProfileCache } from "../../src/db/schema";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import { seedPublicDirectory } from "../fixtures/players";
import { profileResponse } from "../fixtures/osu-profile";
import { assertTestDatabase } from "../database";
import { seedBrowserEditions } from "./setup";
const base = 1221000,
  path = "/tournaments/test-cup/players";
async function addPlayers(ids: number[]) {
  await db()
    .insert(users)
    .values(
      ids.map((osuId) => ({ osuId, username: `Visible Player ${osuId}` })),
    );
  await db()
    .insert(registrations)
    .values(
      ids.map((userId) => ({
        userId,
        editionSlug: "test-cup",
        status: "accepted" as const,
        rulesVersion: null,
        answers: { private: "PRIVATE_DIRECTORY_ANSWER" },
      })),
    );
}
test.describe("compact public player statistics", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.beforeEach(async ({ context }) => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(
      sql`TRUNCATE edition_state, users, user_profile_cache CASCADE`,
    );
    await seedPublicDirectory(base);
    await db().execute(
      sql`UPDATE users SET username = CASE osu_id WHEN ${base} THEN 'S11 Captain' WHEN ${base + 1} THEN 'S11 Member' ELSE 'Hidden Captain' END WHERE osu_id IN (${base}, ${base + 1}, ${base + 3})`,
    );
    await db().execute(
      sql`UPDATE teams SET name = 'Sample Team' WHERE captain_id = ${base}`,
    );
    await addPlayers(Array.from({ length: 5 }, (_, i) => base + 10 + i));
    const ids = [
      base,
      base + 1,
      base + 3,
      ...Array.from({ length: 5 }, (_, i) => base + 10 + i),
    ];
    await db()
      .insert(userProfileCache)
      .values(
        ids.map((osuId, i) => {
          const profile = normalizeOsuProfile(
            { ...profileResponse, id: osuId },
            osuId,
            "osu",
            "2026-10-23T00:00:00Z",
          );
          profile.statistics.globalRank =
            i === 1 || i === 6 ? null : i === 7 ? 0 : 12345;
          profile.statistics.pp = i === 2 || i === 6 ? null : 7890.45;
          return {
            osuId,
            mode: "osu" as const,
            profile,
            attemptedAt: new Date(),
            retryAt: new Date(Date.now() + 3600000),
            errorStatus: i === 3 ? 404 : i === 4 ? 429 : i === 5 ? 503 : null,
          };
        }),
      );
    await context.route("https://a.ppy.sh/**", (route) => route.abort());
  });
  test.afterEach(async () => {
    await db().execute(
      sql`TRUNCATE edition_state, users, user_profile_cache CASCADE`,
    );
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);
  test("shows eight dense cards with independent values and truthful published metadata in every locale/theme/width", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"]) {
        await context.addCookies(
          [
            ["oclr-locale", locale],
            ["oclr-theme", theme],
          ].map(([name, value]) => ({
            name,
            value,
            url: "http://127.0.0.1:3100",
          })),
        );
        for (const width of isMobile ? [320, 390] : [768, 1024, 1440, 1600]) {
          await page.setViewportSize({ width, height: 1000 });
          await page.goto(path);
          const cards = page.locator(".edition-players > ul > li");
          await expect(cards).toHaveCount(8);
          const captain = cards.filter({
            has: page.locator(`a[href="https://osu.ppy.sh/users/${base}"]`),
          });
          await expect(captain).toContainText("#12,345");
          await expect(captain).toContainText("7,890.45");
          await expect(captain).toContainText("osu!standard");
          await expect(captain.locator("time")).toHaveAttribute(
            "datetime",
            "2026-10-23T00:00:00Z",
          );
          await expect(
            captain.locator(`a[href^="/tournaments/test-cup/teams/"]`),
          ).toBeVisible();
          await expect(
            captain.locator(`a[href="/players/${base}?edition=test-cup"]`),
          ).toBeVisible();
          expect((await captain.boundingBox())!.height).toBeLessThan(235);
          if (width > 480)
            expect((await captain.boundingBox())!.width).toBeLessThanOrEqual(
              353,
            );
          await expect(captain.locator("a a")).toHaveCount(0);
          const privateCaptain = cards.filter({
            has: page.locator(`a[href="https://osu.ppy.sh/users/${base + 3}"]`),
          });
          await expect(privateCaptain.locator(".badge")).toHaveCount(1);
          await expect(
            privateCaptain.locator('a[href*="/teams/"]'),
          ).toHaveCount(0);
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if ([390, 1440, 1600].includes(width))
            await page.screenshot({
              path: info.outputPath(
                `players-eight-${locale}-${theme}-${width}.png`,
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
  });
  test("keeps missing fields and provider failures independent without hiding identities", async ({
    page,
  }) => {
    await page.goto(path);
    const cards = page.locator(".edition-players > ul > li");
    for (const [id, values] of [
      [base + 1, ["—", "7,890.45"]],
      [base + 3, ["#12,345", "—"]],
      [base + 10, ["—", "—"]],
      [base + 13, ["—", "—"]],
      [base + 14, ["—", "7,890.45"]],
    ] as const) {
      await expect(
        cards
          .filter({
            has: page.locator(`a[href="https://osu.ppy.sh/users/${id}"]`),
          })
          .locator("dd"),
      ).toHaveText([...values]);
    }
    await expect(page.locator(".edition-players > ul")).not.toContainText("#0");
    for (const id of [base + 11, base + 12]) {
      const card = cards.filter({
        has: page.locator(`a[href="https://osu.ppy.sh/users/${id}"]`),
      });
      await expect(card).toContainText("SAVED SNAPSHOT");
      await expect(card).toContainText("#12,345");
    }
    expect(await page.content()).not.toMatch(
      /PRIVATE_DIRECTORY_ANSWER|SYNTHETIC_PRIVATE_CONTACT|SYNTHETIC_INTERNAL_REASON/,
    );
    expect(
      (await page.goto("/tournaments/private-test-cup/players"))?.status(),
    ).toBe(404);
  });
  test("retains empty, one, 24 and next-page layouts, long names and keyboard profile access", async ({
    page,
  }) => {
    await page.goto(`${path}?q=not-present`);
    await expect(page.locator(".edition-players > ul > li")).toHaveCount(0);
    await page.goto(`${path}?q=${encodeURIComponent("S11 Captain")}`);
    const cards = page.locator(".edition-players > ul > li");
    await expect(cards).toHaveCount(1);
    const link = cards.locator(`a[href="/players/${base}?edition=test-cup"]`);
    await link.focus();
    await expect(link).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/players/${base}\\?edition=test-cup`),
    );
    await addPlayers(Array.from({ length: 17 }, (_, i) => base + 20 + i));
    // Negative cached lookups keep this visual pagination case independent of provider timing.
    await db()
      .insert(userProfileCache)
      .values(
        Array.from({ length: 17 }, (_, i) => ({
          osuId: base + 20 + i,
          mode: "osu" as const,
          attemptedAt: new Date(),
          retryAt: new Date(Date.now() + 3600000),
          errorStatus: 503,
        })),
      );
    await db().execute(
      sql`UPDATE users SET username = ${"中文與EnglishVeryLongUsername".repeat(4)} WHERE osu_id = ${base + 20}`,
    );
    await page.goto(path);
    await expect(cards).toHaveCount(24);
    await page.getByRole("link", { name: "Next →", exact: true }).click();
    await expect(cards).toHaveCount(1);
    await page.getByRole("link", { name: "← Previous", exact: true }).click();
    await expect(cards).toHaveCount(24);
    for (const width of [320, 390, 768, 1024, 1440, 1600]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(`${path}?q=${base + 20}`);
      await expect(cards).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await expect(
      page.locator('a[href="https://osu.ppy.sh/users/' + (base + 2) + '"]'),
    ).toHaveCount(0);
  });
});
