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
          await expect(captain).not.toContainText("osu!standard");
          await expect(captain).not.toContainText("SAVED SNAPSHOT");
          if (locale === "zh-Hant") {
            await expect(page.locator(".edition-players")).toContainText(
              "已通過選手",
            );
            await expect(page.locator(".edition-players")).not.toContainText(
              "已透過選手",
            );
          }
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
      await expect(card).not.toContainText("SAVED SNAPSHOT");
      await expect(card.locator("time")).toHaveAttribute(
        "datetime",
        "2026-10-23T00:00:00Z",
      );
      await expect(card).toContainText("#12,345");
    }
    expect(await page.content()).not.toMatch(
      /PRIVATE_DIRECTORY_ANSWER|SYNTHETIC_PRIVATE_CONTACT|SYNTHETIC_INTERNAL_REASON/,
    );
    expect(
      (await page.goto("/tournaments/private-test-cup/players"))?.status(),
    ).toBe(404);
  });
  test("shows the same cached public records in compact rows across locales, themes and widths", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(180000);
    const cacheBefore = await db()
      .select()
      .from(userProfileCache)
      .orderBy(userProfileCache.osuId);
    const records = () =>
      page.locator(".edition-players > ul > li").evaluateAll((rows) =>
        rows.map((row) => ({
          identity: row
            .querySelector('a[href^="https://osu.ppy.sh/users/"]')
            ?.getAttribute("href"),
          values: [...row.querySelectorAll("dd")].map(
            (value) => value.textContent,
          ),
          badges: [...row.querySelectorAll(".badge")].map(
            (value) => value.textContent,
          ),
          team: row.querySelector('a[href*="/teams/"]')?.getAttribute("href"),
          updated: row.querySelector("time")?.getAttribute("datetime"),
        })),
      );
    await page.goto(path);
    const cards = await records();
    await page
      .getByRole("navigation", { name: "Player view", exact: true })
      .getByRole("link", { name: "List", exact: true })
      .click();
    expect(await records()).toEqual(cards);
    const rows = page.locator(".edition-players > ul > li");
    await expect(rows).toHaveCount(8);
    await expect(page.locator(".edition-players")).not.toContainText(
      "Cached statistics",
    );
    await expect(page.locator(".edition-players")).not.toContainText(
      "osu!standard",
    );
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"])
        for (const appearance of ["default", "cute-pastel"]) {
          await context.addCookies(
            [
              ["oclr-locale", locale],
              ["oclr-theme", theme],
              ["oclr-appearance", appearance],
            ].map(([name, value]) => ({
              name,
              value,
              url: "http://127.0.0.1:3100",
            })),
          );
          for (const width of isMobile ? [320, 390] : [768, 1024, 1440, 1600]) {
            await page.setViewportSize({ width, height: 900 });
            await page.goto(path + "?view=list");
            expect(
              (await records()).map(({ identity, values, team }) => ({
                identity,
                values,
                team,
              })),
            ).toEqual(
              cards.map(({ identity, values, team }) => ({
                identity,
                values,
                team,
              })),
            );
            await expect(rows).toHaveCount(8);
            const captain = rows.filter({
              has: page.locator(`a[href="https://osu.ppy.sh/users/${base}"]`),
            });
            await expect(captain.locator("dd")).toHaveText([
              "#12,345",
              "7,890.45",
            ]);
            await expect(captain.locator('a[href*="/teams/"]')).toBeVisible();
            await expect(
              captain.locator(`a[href="/players/${base}?edition=test-cup"]`),
            ).toBeVisible();
            await expect(captain.locator("a a")).toHaveCount(0);
            if (width >= 1024)
              expect((await captain.boundingBox())!.height).toBeLessThan(90);
            const hidden = rows.filter({
              has: page.locator(
                `a[href="https://osu.ppy.sh/users/${base + 3}"]`,
              ),
            });
            await expect(hidden.locator(".badge")).toHaveCount(1);
            await expect(hidden.locator('a[href*="/teams/"]')).toHaveCount(0);
            expect(
              await page.evaluate(
                () => document.documentElement.scrollWidth <= innerWidth,
              ),
            ).toBe(true);
            if ([390, 1440].includes(width))
              await page.screenshot({
                path: info.outputPath(
                  `players-list-${locale}-${theme}-${appearance}-${width}.png`,
                ),
                fullPage: true,
                animations: "disabled",
              });
          }
        }
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await db()
        .select()
        .from(userProfileCache)
        .orderBy(userProfileCache.osuId),
    ).toEqual(cacheBefore);
    expect(await page.content()).not.toMatch(
      /PRIVATE_DIRECTORY_ANSWER|SYNTHETIC_PRIVATE_CONTACT|SYNTHETIC_INTERNAL_REASON/,
    );
    expect(
      (
        await page.goto("/tournaments/private-test-cup/players?view=list")
      )?.status(),
    ).toBe(404);
  });
  test("preserves view, search and page through switching, pagination and a native search form", async ({
    page,
  }) => {
    test.setTimeout(90000);
    await addPlayers(Array.from({ length: 17 }, (_, i) => base + 20 + i));
    await db()
      .insert(userProfileCache)
      .values(
        Array.from({ length: 17 }, (_, i) => ({
          osuId: base + 20 + i,
          mode: "osu",
          attemptedAt: new Date(),
          retryAt: new Date(Date.now() + 3600000),
          errorStatus: 503,
        })),
      );
    const search = "名单 + & English";
    await db().execute(
      sql`UPDATE users SET username = ${search} || ' ' || osu_id WHERE osu_id BETWEEN ${base} AND ${base + 40}`,
    );
    await page.goto(`${path}?q=${encodeURIComponent(search)}&page=2`);
    const entries = page.locator(".edition-players > ul > li");
    const views = page.getByRole("navigation", {
      name: "Player view",
      exact: true,
    });
    await expect(entries).toHaveCount(1);
    await expect(
      views.getByRole("link", { name: "Cards", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await views.getByRole("link", { name: "List", exact: true }).focus();
    await page.keyboard.press("Enter");
    await expect(
      views.getByRole("link", { name: "List", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    let query = new URL(page.url()).searchParams;
    expect(Object.fromEntries(query)).toEqual({
      q: search,
      page: "2",
      view: "list",
    });
    await expect(entries).toHaveCount(1);
    await page.getByRole("link", { name: "← Previous", exact: true }).click();
    await expect(entries).toHaveCount(24);
    expect(new URL(page.url()).searchParams.get("view")).toBe("list");
    await views.getByRole("link", { name: "Cards", exact: true }).click();
    await expect(
      views.getByRole("link", { name: "Cards", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await expect(entries).toHaveCount(24);
    expect(new URL(page.url()).searchParams.get("q")).toBe(search);
    await views.getByRole("link", { name: "List", exact: true }).click();
    await expect(
      views.getByRole("link", { name: "List", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    await page
      .getByRole("textbox", { name: "Search players" })
      .fill(String(base));
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(entries).toHaveCount(1);
    query = new URL(page.url()).searchParams;
    expect(query.get("view")).toBe("list");
    expect(query.has("page")).toBe(false);
    await page
      .getByRole("textbox", { name: "Search players" })
      .fill("not-a-visible-player");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(entries).toHaveCount(0);
    await expect(
      page.getByRole("link", { name: "Clear filters", exact: true }),
    ).toHaveAttribute("href", path + "?view=list");
    await page
      .getByRole("link", { name: "Clear filters", exact: true })
      .click();
    await expect(entries).toHaveCount(24);
    await db().execute(
      sql`UPDATE users SET username = ${"中文與EnglishVeryLongUsername".repeat(4)} WHERE osu_id=${base}`,
    );
    await page.goto(`${path}?view=list&q=${base}`);
    for (const width of [320, 390, 768, 1024, 1440, 1600]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(entries).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    await entries
      .locator(`a[href="/players/${base}?edition=test-cup"]`)
      .focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      `http://127.0.0.1:3100/players/${base}?edition=test-cup`,
    );
    for (const invalid of [
      "view=other",
      "view=list&view=cards",
      "view=list&page=zero",
      "view=list&private=true",
    ]) {
      await page.goto(`${path}?${invalid}`);
      await expect(
        page.getByRole("link", { name: "Clear filters", exact: true }),
      ).toBeVisible();
      await expect(entries).toHaveCount(0);
    }
  });
  test("supports list switching and searching without JavaScript", async ({
    browser,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    try {
      await context.addCookies([
        { name: "oclr-locale", value: "en", url: "http://127.0.0.1:3100" },
      ]);
      await context.route("https://a.ppy.sh/**", (route) => route.abort());
      const page = await context.newPage();
      await page.goto("http://127.0.0.1:3100" + path + "?view=list");
      await expect(page.locator(".edition-players > ul > li")).toHaveCount(8);
      const views = page.getByRole("navigation", {
        name: "Player view",
        exact: true,
      });
      await views.getByRole("link", { name: "Cards", exact: true }).click();
      await expect(
        views.getByRole("link", { name: "Cards", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await views.getByRole("link", { name: "List", exact: true }).click();
      await page
        .getByRole("textbox", { name: "Search players" })
        .fill(String(base));
      await page.getByRole("button", { name: "Search", exact: true }).click();
      await expect(page.locator(".edition-players > ul > li")).toHaveCount(1);
      expect(new URL(page.url()).searchParams.get("view")).toBe("list");
    } finally {
      await context.close();
    }
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
