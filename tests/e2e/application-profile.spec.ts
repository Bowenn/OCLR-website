import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  registrations,
  users,
  userProfileCache,
  staffRoles,
} from "../../src/db/schema";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import {
  evaluateEligibility,
  noEligibilityLimits,
} from "../../src/lib/eligibility-model";
import { createSession } from "../../src/lib/auth/sessions";
import { seedSession } from "./session";
import { seedBrowserEditions } from "./setup";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { profileResponse } from "../fixtures/osu-profile";
import { assertTestDatabase } from "../database";
import { englishStorage } from "../fixtures/preferences";
const userId = 993121;
async function saveProfile(
  rank: number | null = 12345,
  pp: number | null = 1234.56,
  stale = false,
) {
  const fetchedAt = new Date(Date.now() - (stale ? 3600000 : 0)).toISOString();
  const profile = normalizeOsuProfile(
    { ...profileResponse, id: userId },
    userId,
    "osu",
    fetchedAt,
  );
  profile.statistics.globalRank = rank;
  profile.statistics.pp = pp;
  await db()
    .insert(userProfileCache)
    .values({
      osuId: userId,
      mode: "osu",
      profile,
      attemptedAt: new Date(),
      retryAt: new Date(Date.now() + 60000),
      errorStatus: stale ? 503 : null,
    })
    .onConflictDoUpdate({
      target: [userProfileCache.osuId, userProfileCache.mode],
      set: {
        profile,
        errorStatus: stale ? 503 : null,
        retryAt: new Date(Date.now() + 60000),
      },
    });
  return profile;
}
test.describe("private applicant statistics", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(
      sql`TRUNCATE edition_state, users, user_profile_cache CASCADE`,
    );
    await seedEditions([
      { ...edition, automaticEligibility: null },
      { ...edition, slug: "other-test-cup" },
    ]);
    await db()
      .insert(users)
      .values({ osuId: userId, username: "Synthetic Review Applicant" });
  });
  test.afterEach(async () => {
    await db().execute(
      sql`TRUNCATE edition_state, users, user_profile_cache CASCADE`,
    );
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);
  test("shows current and saved eligibility snapshots separately across statuses, locales and themes", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    await context.addCookies([await seedSession(60001)]);
    const [r] = await db()
      .insert(registrations)
      .values({
        editionSlug: edition.slug,
        userId,
        status: "pending",
        answers: {},
        rulesVersion: null,
      })
      .returning();
    const path = `/admin/tournaments/${edition.slug}/registrations/${r.id}`;
    await saveProfile();
    for (const status of [
      "pending",
      "accepted",
      "rejected",
      "withdrawn",
    ] as const) {
      await db()
        .update(registrations)
        .set({ status, source: status === "withdrawn" ? "staff" : "player" })
        .where(eq(registrations.id, r.id));
      await page.goto(path);
      const row = page.locator(".application-profile-summary");
      await expect(row).toContainText("osu!standard");
      await expect(row).toContainText("#12,345");
      await expect(row).toContainText("1,234.56");
      await expect(page.locator(".eligibility-summary")).toHaveCount(0);
    }
    const historical = normalizeOsuProfile(
      { ...profileResponse, id: userId },
      userId,
      "osu",
    );
    historical.statistics.globalRank = 54321;
    historical.statistics.pp = 9000;
    const verification = evaluateEligibility(userId, 0, noEligibilityLimits, {
      profile: historical,
      stale: false,
      notice: null,
    });
    await db()
      .update(registrations)
      .set({ status: "accepted", eligibilityVerification: verification })
      .where(eq(registrations.id, r.id));
    await saveProfile(12345, 1234.56, true);
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
        for (const width of isMobile ? [320, 390] : [1024, 1440]) {
          await page.setViewportSize({ width, height: 900 });
          await page.goto(path);
          const row = page.locator(".application-profile-summary");
          await expect(row).toContainText("#12,345");
          await expect(row).toContainText("1,234.56");
          await expect(row.locator(".badge")).toBeVisible();
          await expect(page.locator(".eligibility-summary")).toContainText(
            "54321",
          );
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if ([390, 1440].includes(width))
            await page.screenshot({
              path: info.outputPath(
                `review-stats-${locale}-${theme}-${width}.png`,
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
    const [saved] = await db()
      .select()
      .from(registrations)
      .where(eq(registrations.id, r.id));
    expect(saved.eligibilityVerification).toEqual(verification);
  });
  test("keeps missing values independent and review actions usable under cached provider errors", async ({
    page,
    context,
  }) => {
    await context.addCookies([await seedSession(60001)]);
    const [r] = await db()
      .insert(registrations)
      .values({
        editionSlug: edition.slug,
        userId,
        answers: {},
        rulesVersion: null,
      })
      .returning();
    const path = `/admin/tournaments/${edition.slug}/registrations/${r.id}`;
    for (const [rank, pp] of [
      [null, 1234.56],
      [12345, null],
      [0, null],
    ] as const) {
      await saveProfile(rank, pp);
      await page.goto(path);
      const row = page.locator(".application-profile-summary");
      await expect(row).toContainText("Unavailable");
      await expect(row).not.toContainText("#0");
      if (rank && rank > 0) await expect(row).toContainText("#12,345");
      if (pp !== null) await expect(row).toContainText("1,234.56");
    }
    for (const errorStatus of [404, 429, 503]) {
      await db()
        .update(userProfileCache)
        .set({
          profile: null,
          errorStatus,
          retryAt: new Date(Date.now() + 60000),
        })
        .where(eq(userProfileCache.osuId, userId));
      await page.goto(path);
      await expect(page.locator(".application-profile-summary dd")).toHaveText([
        "Unavailable",
        "Unavailable",
      ]);
      await expect(
        page.getByRole("button", { name: "Review decision", exact: true }),
      ).toBeVisible();
      await expect(page.locator("main")).toContainText("Registration source");
    }
  });
  test("authorizes before profile lookup, respects edition scope/revocation and does not fetch on the list", async ({
    page,
    context,
    browser,
  }) => {
    const [r] = await db()
      .insert(registrations)
      .values({
        editionSlug: edition.slug,
        userId,
        answers: { private: "PRIVATE_ANSWER" },
        rulesVersion: null,
      })
      .returning();
    const path = `/admin/tournaments/${edition.slug}/registrations/${r.id}`;
    expect((await context.request.get(path)).url()).toContain("/login");
    expect(await db().select().from(userProfileCache)).toHaveLength(0);
    const scopedId = 993122;
    await db()
      .insert(users)
      .values({ osuId: scopedId, username: "Synthetic Scoped Admin" });
    const [grant] = await db()
      .insert(staffRoles)
      .values({
        userId: scopedId,
        role: "admin",
        editionSlug: "other-test-cup",
        grantedBy: 60001,
      })
      .returning();
    const session = await createSession(scopedId);
    const scoped = await browser.newContext({
      storageState: englishStorage,
      baseURL: "http://127.0.0.1:3100",
    });
    await scoped.addCookies([
      {
        name: "oclr_session",
        value: session.token,
        url: "http://127.0.0.1:3100",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    try {
      expect((await scoped.request.get(path)).status()).toBe(404);
      expect(await db().select().from(userProfileCache)).toHaveLength(0);
      await db()
        .update(staffRoles)
        .set({ editionSlug: edition.slug })
        .where(eq(staffRoles.id, grant.id));
      const allowed = await scoped.newPage();
      await allowed.goto(`/admin/tournaments/${edition.slug}/registrations`);
      expect(await db().select().from(userProfileCache)).toHaveLength(0);
      await saveProfile();
      await allowed.goto(path);
      await expect(
        allowed.locator(".application-profile-summary"),
      ).toContainText("#12,345");
      await db().delete(userProfileCache);
      await db()
        .update(staffRoles)
        .set({ revokedAt: new Date() })
        .where(eq(staffRoles.id, grant.id));
      expect((await scoped.request.get(path)).status()).toBe(404);
      expect(await db().select().from(userProfileCache)).toHaveLength(0);
    } finally {
      await scoped.close();
    }
    await context.addCookies([await seedSession(60001)]);
    await page.goto(path);
    await expect(page.locator(".application-profile-summary")).toContainText(
      "Unavailable",
    );
  });
});
