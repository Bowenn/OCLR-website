import { test, expect, type BrowserContext } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db, closeDb } from "../../src/db";
import {
  teams,
  captains,
  registrations,
  draftSessions,
  userProfileCache,
  editionState,
  tournamentRounds,
  mappools,
} from "../../src/db/schema";
import { seedSession } from "./session";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { seedPublicPolish } from "../fixtures/public-polish";
import { prepareDraft } from "../fixtures/draft";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import { noEligibilityLimits } from "../../src/lib/eligibility-model";
import { createSession } from "../../src/lib/auth/sessions";
async function preferences(
  context: BrowserContext,
  locale: string,
  theme = "light",
) {
  await context.addCookies([
    ...[
      ["oclr-locale", locale],
      ["oclr-theme", theme],
    ].map(([name, value]) => ({ name, value, domain: "127.0.0.1", path: "/" })),
  ]);
}
test.describe("focused workflow improvements", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("direct tournament navigation and flattened single pool remain accessible", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const admin = isMobile ? 70001 : 60001;
    await seedSession(admin);
    process.env.ADMIN_OSU_IDS = String(admin);
    await db().execute(sql`TRUNCATE tournament_stages CASCADE`);
    const seed = await seedPublicPolish(
      admin,
      admin + 100,
      isMobile ? 923000 : 922000,
    );
    await db()
      .update(mappools)
      .set({ name: "GS" })
      .where(eq(mappools.id, seed.poolId!));
    await db()
      .update(tournamentRounds)
      .set({ name: "GS" })
      .where(eq(tournamentRounds.id, seed.context.fixture.roundId));
    await seedEditions([
      {
        ...edition,
        slug: "private-navigation-test",
        name: "PRIVATE_EDITION",
        published: false,
      },
    ]);
    await db().execute(
      sql`UPDATE edition_state SET configuration = configuration || '{"published":false}'::jsonb WHERE slug <> 'test-cup'`,
    );
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"]) {
        await preferences(context, locale, theme);
        await page.goto("/tournaments/test-cup/mappools");
        await expect(page.locator(".mappool-public-round")).toHaveCount(0);
        await expect(page.locator(".mappool-release-heading h3")).toContainText(
          "GS",
        );
        expect(
          (await page.locator(".mappool-release-heading").innerText()).match(
            /GS/g,
          ),
        ).toHaveLength(1);
        await page.setViewportSize({
          width: isMobile ? 320 : 1440,
          height: 900,
        });
        if (isMobile) await page.locator(".menu-toggle").click();
        await page
          .locator('.main-nav > a[href="/tournaments/test-cup"]')
          .click();
        await expect(page).toHaveURL(/\/tournaments\/test-cup$/);
        await expect(page.locator(".header-tournaments")).toHaveCount(0);
        await expect(page.locator("main")).not.toContainText("PRIVATE_EDITION");
        await page.screenshot({
          path: info.outputPath(`tournaments-index-${locale}-${theme}.png`),
        });
      }
  });
  test("captain publication loads saved settings and saves independent switches", async ({
    page,
    context,
    isMobile,
  }, info) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const base = isMobile ? 120001 : 110001;
    process.env.ADMIN_OSU_IDS = String(base);
    await db().execute(sql`TRUNCATE edition_state,users CASCADE`);
    const fixture = await prepareDraft("captain-controls-test", base, 2, false);
    const session = await createSession(fixture.staff.osuId);
    await context.addCookies([
      {
        name: "oclr_session",
        value: session.token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await db()
      .update(editionState)
      .set({ poolPublished: true })
      .where(eq(editionState.slug, "captain-controls-test"));
    await preferences(context, "en");
    await page.goto("/admin/tournaments/captain-controls-test/captains");
    const captain = page.getByLabel("Publish captains & order"),
      pool = page.getByLabel("Publish eligible draft pool");
    await expect(captain).toBeChecked();
    await expect(pool).toBeChecked();
    await expect(
      page.getByText("Publication and advanced controls"),
    ).toHaveCount(0);
    await pool.uncheck();
    await page
      .getByRole("button", { name: "Save publication settings", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    await page.reload();
    await expect(captain).toBeChecked();
    await expect(pool).not.toBeChecked();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"]) {
        await preferences(context, locale, theme);
        await page.reload();
        await page.screenshot({
          path: info.outputPath(
            `captain-visible-controls-${locale}-${theme}.png`,
          ),
          fullPage: true,
        });
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
  });
  test("team branding upload persists, is permission checked and respects publication", async ({
    page,
    context,
    isMobile,
  }, info) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const base = isMobile ? 120001 : 110001;
    process.env.ADMIN_OSU_IDS = String(base);
    await db().execute(sql`TRUNCATE edition_state,users CASCADE`);
    const f = await prepareDraft("team-branding-test", base);
    const session = await createSession(f.staff.osuId);
    await context.addCookies([
      {
        name: "oclr_session",
        value: session.token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await preferences(context, "en");
    await page.goto("/admin/tournaments/team-branding-test/teams");
    await page
      .getByRole("button", { name: "Edit team", exact: true })
      .first()
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Team name", { exact: true })
      .fill("Synthetic uploaded team");
    const bytes = await sharp({
      create: { width: 120, height: 80, channels: 3, background: "#aa44bb" },
    })
      .png()
      .toBuffer();
    await dialog.getByLabel("Team avatar", { exact: true }).setInputFiles({
      name: "synthetic.png",
      mimeType: "image/png",
      buffer: bytes,
    });
    await expect(dialog.getByAltText("Pending team image")).toBeVisible();
    await expect(dialog.getByAltText("Pending team image")).toHaveJSProperty(
      "complete",
      true,
    );
    await expect
      .poll(() =>
        dialog
          .getByAltText("Pending team image")
          .evaluate((image: HTMLImageElement) => image.naturalWidth),
      )
      .toBeGreaterThan(0);
    await dialog
      .getByRole("button", { name: "Save team", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Synthetic uploaded team" }),
    ).toBeVisible();
    const [team] = await db()
      .select()
      .from(teams)
      .where(eq(teams.name, "Synthetic uploaded team"));
    expect(team.avatarKey).not.toBeNull();
    expect(
      (await context.request.get(`/api/teams/${team.id}/avatar`)).headers()[
        "content-type"
      ],
    ).toBe("image/webp");
    const guest = await page
      .context()
      .browser()!
      .newContext({ baseURL: "http://127.0.0.1:3100" });
    try {
      expect(
        (await guest.request.get(`/api/teams/${team.id}/avatar`)).status(),
      ).toBe(200);
      expect(
        (
          await guest.request.patch(
            `/api/admin/tournaments/team-branding-test/teams/${team.id}`,
            {
              headers: { origin: "http://127.0.0.1:3100" },
              multipart: { name: "forged" },
            },
          )
        ).status(),
      ).toBe(401);
      await db()
        .update(teams)
        .set({ identityPublished: false })
        .where(eq(teams.id, team.id));
      expect(
        (await guest.request.get(`/api/teams/${team.id}/avatar`)).status(),
      ).toBe(404);
    } finally {
      await guest.close();
    }
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"]) {
        await preferences(context, locale, theme);
        await page.reload();
        const card = page.locator("article").filter({
          has: page.getByRole("heading", {
            name: "Synthetic uploaded team",
            exact: true,
          }),
        });
        await card.locator("button").first().click();
        await page.screenshot({
          path: info.outputPath(`team-image-editor-${locale}-${theme}.png`),
          fullPage: true,
        });
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      }
    await preferences(context, "en");
    await page.reload();
    await page
      .locator("article")
      .filter({
        has: page.getByRole("heading", {
          name: "Synthetic uploaded team",
          exact: true,
        }),
      })
      .getByRole("button", { name: "Edit team", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Remove avatar", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Save team", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    expect(
      (await context.request.get(`/api/teams/${team.id}/avatar`)).status(),
    ).toBe(404);
  });
  test("unlocked private rehearsal saves and starts with one player for two planned turns", async ({
    page,
    context,
    isMobile,
  }, info) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const base = isMobile ? 120001 : 110001;
    process.env.ADMIN_OSU_IDS = String(base);
    await db().execute(sql`TRUNCATE edition_state,users CASCADE`);
    const f = await prepareDraft("private-start-test", base, 2, false);
    await db()
      .update(editionState)
      .set({ lockedAt: null })
      .where(eq(editionState.slug, "private-start-test"));
    await db().update(captains).set({ published: false });
    await db().update(teams).set({ identityPublished: false });
    await db().update(draftSessions).set({ turnSequence: [] });
    await db()
      .update(registrations)
      .set({ draftUnavailableReason: "Synthetic unavailable" })
      .where(sql`user_id >= ${f.players[1].osuId}`);
    const session = await createSession(f.staff.osuId);
    await context.addCookies([
      {
        name: "oclr_session",
        value: session.token,
        domain: "127.0.0.1",
        path: "/",
      },
    ]);
    await preferences(context, "en");
    await page.goto("/admin/tournaments/private-start-test/draft");
    await page
      .getByRole("combobox", { name: "Order mode", exact: true })
      .selectOption("snake");
    await page.getByLabel("Pick rounds", { exact: true }).fill("1");
    await page
      .getByRole("button", { name: "Save draft configuration", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Start draft", exact: true }),
    ).toBeEnabled();
    await page
      .getByRole("button", { name: "Start draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Pause draft", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", {
        name: `Choose ${f.players[0].username}`,
        exact: true,
      })
      .click();
    await page.locator(".draft-pending-pick button").first().click();
    await expect(
      page.getByText(
        "No eligible players remain. Pause the draft to review or abort and reconfigure.",
      ),
    ).toBeVisible();
    expect(
      (
        await context.request.get("/api/tournaments/private-start-test/draft")
      ).status(),
    ).toBe(200);
    expect(
      await (
        await context.request.get("/api/tournaments/private-start-test/draft")
      ).json(),
    ).toBeNull();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Pause draft", exact: true }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Pause draft", exact: true })
      .click();
    await expect(
      page.getByRole("button", { name: "Resume draft", exact: true }),
    ).toBeVisible();
    await page.screenshot({
      path: info.outputPath("private-short-pool-draft.png"),
      fullPage: true,
    });
  });
  test("registration shows verified limits and enforces pass/fail/unavailable on the server", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const base = isMobile ? 967100 : 967000;
    for (let i = 0; i < 3; i++) {
      const id = base + i,
        cookie = await seedSession(id);
      await context.addCookies([cookie]);
      await seedEditions([
        {
          ...edition,
          rules: null,
          eligibility: null,
          automaticEligibility: {
            ...noEligibilityLimits,
            maxPp: 8000,
            minRank: 10000,
          },
        },
      ]);
      await db()
        .insert(userProfileCache)
        .values({
          osuId: id,
          mode: "osu",
          profile: normalizeOsuProfile(
            {
              id,
              username: `Synthetic Player ${id}`,
              statistics: {
                pp: i === 1 ? 8001 : 7999,
                global_rank: i === 2 ? null : 10000,
              },
            },
            id,
            "osu",
          ),
          attemptedAt: new Date(),
          retryAt: new Date(),
        })
        .onConflictDoNothing();
      await preferences(context, "en");
      await page.goto("/tournaments/test-cup/register");
      await expect(page.locator(".eligibility-summary")).toContainText(
        i === 0 ? "Pass" : i === 1 ? "Does not meet" : "Unable to verify",
      );
      await expect(page.getByRole("checkbox")).toHaveCount(0);
      if (i === 0) {
        for (const locale of ["en", "zh-Hans", "zh-Hant"]) {
          await preferences(context, locale);
          await page.reload();
          await page.screenshot({
            path: info.outputPath(`automatic-eligibility-${locale}.png`),
            fullPage: true,
          });
        }
        await preferences(context, "en");
        await page.reload();
        await page
          .getByRole("button", {
            name: "Submit individual application",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/dashboard/);
      } else {
        await page
          .getByRole("button", {
            name: "Submit individual application",
            exact: true,
          })
          .click();
        await expect(page.locator("form [role=alert]")).toContainText(
          i === 1 ? "do not meet" : "Unable to verify",
        );
      }
    }
  });
});
