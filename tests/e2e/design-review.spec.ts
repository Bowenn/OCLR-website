import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync, writeFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { registrations, userProfileCache, users } from "../../src/db/schema";
import { seedSession } from "./session";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { seedPublicDirectory } from "../fixtures/players";
import { bracketFixture } from "../fixtures/bracket";
import { profileResponse } from "../fixtures/osu-profile";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import { assertTestDatabase } from "../database";

test.describe("concept-aligned tournament surfaces", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("renders honest edition artwork, private player data and compact competition workspaces", async ({
    page,
    context,
    isMobile,
  }, info) => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(
      sql`TRUNCATE edition_state, users, user_profile_cache CASCADE`,
    );
    const base = isMobile ? 630100 : 630000;
    const adminCookie = await seedSession(isMobile ? 70001 : 60001);
    const playerCookie = await seedSession(base + 20);
    const a = await seedPublicDirectory(base);
    const b = await seedPublicDirectory(base + 1000);
    const brandedEdition = {
      ...edition,
      name: "Synthetic Season 11 rehearsal",
      season: "11",
      status: "live",
      summary:
        "Synthetic visual rehearsal. Individual registration and captain-led team competition.",
      branding: {
        logo: "/oclr-s11-square-logo.webp",
        background: "/oclr-s11-website-background.webp",
        keyVisual: "/oclr-s11-key-visual.webp",
      },
    };
    await seedEditions([brandedEdition]);
    await db()
      .insert(registrations)
      .values({
        editionSlug: edition.slug,
        userId: base + 20,
        status: "pending",
        rulesVersion: "test-v1",
        configurationVersion: 0,
        answers: { private: "VISUAL_PRIVATE_ANSWER" },
        createdAt: new Date("2026-01-02T12:00:00Z"),
      });
    await db()
      .insert(users)
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          osuId: base + 30 + i,
          username: `Synthetic Applicant ${i + 1}`,
        })),
      );
    await db()
      .insert(registrations)
      .values(
        Array.from({ length: 6 }, (_, i) => ({
          editionSlug: edition.slug,
          userId: base + 30 + i,
          status: ["pending", "accepted", "rejected"][i % 3] as
            "pending" | "accepted" | "rejected",
          rulesVersion: "test-v1",
          answers: {},
          createdAt: new Date("2026-01-02T12:00:00Z"),
        })),
      );
    await db()
      .insert(userProfileCache)
      .values({
        osuId: base + 20,
        mode: "osu",
        profile: normalizeOsuProfile(
          {
            ...profileResponse,
            id: base + 20,
            username: `Synthetic Player ${base + 20}`,
            avatar_url: `https://a.ppy.sh/${base + 20}`,
          },
          base + 20,
          "osu",
        ),
        attemptedAt: new Date(),
        retryAt: new Date(),
      });
    await context.route("https://a.ppy.sh/**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" rx="44" fill="#68408b"/><text x="44" y="52" text-anchor="middle" font-size="26" fill="white">VR</text></svg>',
      }),
    );
    await page.setViewportSize({
      width: isMobile ? 390 : 1440,
      height: isMobile ? 844 : 900,
    });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const bracketPath = process.env.OCLR_TEST_BRACKETS_FILE!;
    const previous = readFileSync(bracketPath, "utf8");
    writeFileSync(
      bracketPath,
      JSON.stringify([bracketFixture(edition.slug, a.teamId, b.teamId)]),
    );
    async function capture(
      target: Page,
      name: string,
      path: string,
      accessibility = false,
    ) {
      await target.goto(path);
      await expect(target.getByRole("heading", { level: 1 })).toBeVisible();
      expect(
        await target.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      for (const img of await target.locator('img[src^="/oclr-s11-"]').all()) {
        await img.scrollIntoViewIfNeeded();
        await expect
          .poll(() =>
            img.evaluate((el) => (el as HTMLImageElement).naturalWidth),
          )
          .toBeGreaterThan(0);
      }
      await target.evaluate(() => window.scrollTo(0, 0));
      await target.screenshot({
        path: info.outputPath(
          `${process.env.OCLR_DESIGN_CAPTURE ?? "after"}-${name}.png`,
        ),
        fullPage: true,
        animations: "disabled",
      });
      if (accessibility)
        expect(
          (
            await new AxeBuilder({ page: target })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
    }
    try {
      for (const [name, path] of [
        ["home", "/"],
        ["tournaments", "/tournaments"],
        ["overview", "/tournaments/test-cup"],
        ["players", "/players"],
        ["news", "/news"],
        ["about", "/about"],
      ]) {
        await capture(page, name, path, true);
        if (name === "home")
          await expect(page.locator(".hero-art")).toHaveCSS(
            "animation-name",
            "none",
          );
        if (name === "overview")
          await expect(
            page
              .getByRole("navigation", { name: "Tournament navigation" })
              .locator('[aria-current="page"]'),
          ).toHaveText("Overview");
        expect(await page.locator("main").innerText()).not.toContain(
          "VISUAL_PRIVATE_ANSWER",
        );
      }
      await capture(page, "bracket", "/tournaments/test-cup/bracket", true);
      const tournamentNav = page.getByRole("navigation", {
        name: "Tournament navigation",
      });
      await expect(tournamentNav.locator('[aria-current="page"]')).toHaveText(
        "Bracket",
      );
      await expect(
        tournamentNav.locator('[aria-current="page"]'),
      ).toBeInViewport();
      await tournamentNav
        .getByRole("link", { name: "Mappools", exact: true })
        .focus();
      await page.keyboard.press("Enter");
      await expect(tournamentNav.locator('[aria-current="page"]')).toHaveText(
        "Mappools",
      );
      await page.goto("/tournaments/test-cup/bracket");
      await expect(page.locator(".match-card")).toHaveCount(2);
      await expect(page.locator(".match-winner")).toHaveCount(1);
      await context.addCookies([playerCookie]);
      await capture(page, "dashboard", "/dashboard", true);
      await expect(
        page.getByRole("heading", { name: /Synthetic Season 11 rehearsal/ }),
      ).toBeVisible();
      await expect(page.locator(".registration-cover img")).toHaveJSProperty(
        "naturalWidth",
        1200,
      );
      await expect(page.getByText("#12,345", { exact: true })).toBeVisible();
      await expect(page.getByText("1,234.56", { exact: true })).toBeVisible();
      await expect(page.getByText("97.25%", { exact: true })).toBeVisible();
      await page
        .getByText("My acknowledged rules and application", { exact: true })
        .click();
      await expect(
        page.getByText("VISUAL_PRIVATE_ANSWER", { exact: true }),
      ).toBeVisible();
      await expect(page.getByText(/Acknowledged rules: test-v1/)).toBeVisible();
      // Missing provider fields stay unavailable, and a query cannot select another identity.
      await db()
        .update(userProfileCache)
        .set({
          profile: normalizeOsuProfile(
            { ...profileResponse, id: base + 20, statistics: null },
            base + 20,
            "osu",
          ),
        })
        .where(eq(userProfileCache.osuId, base + 20));
      await page.goto(`/dashboard?osuId=${base}`);
      await expect(
        page
          .locator(".player-statistics dd")
          .filter({ hasText: "Unavailable" }),
      ).toHaveCount(3);
      await expect(page.locator("#identity")).toContainText(
        `osu! ID: ${base + 20}`,
      );
      for (const width of [320, 768, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() =>
            [...document.querySelectorAll("main *")]
              .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
              .map((el) => `${el.tagName}.${el.className}`),
          ),
          `Overflow at ${width}px`,
        ).toEqual([]);
      }
      await page.setViewportSize({
        width: isMobile ? 390 : 1440,
        height: isMobile ? 844 : 900,
      });
      await context.addCookies([adminCookie]);
      await capture(
        page,
        "registrations",
        "/admin/tournaments/test-cup/registrations",
        true,
      );
      await expect(page.getByRole("table")).toBeVisible();
      await page
        .getByLabel("Search player or osu! ID")
        .fill("Synthetic Applicant 1");
      await page.getByRole("button", { name: "Filter", exact: true }).click();
      await expect(
        page.getByRole("cell", { name: "Synthetic Applicant 1", exact: true }),
      ).toBeVisible();
    } finally {
      writeFileSync(bracketPath, previous);
      await seedEditions([edition]);
    }
  });
});
