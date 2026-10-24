import { expect, test } from "@playwright/test";
import { db, closeDb } from "../../src/db";
import { users, registrations, userProfileCache } from "../../src/db/schema";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
import { profileResponse } from "../fixtures/osu-profile";
test.describe("complete directory statistics (#266)", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("shows cached rank and PP for all 27 players, including zero PP", async ({
    page,
    isMobile,
  }, info) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const slug = isMobile ? "stats-mobile-test" : "stats-desktop-test";
    await seedEditions([{ ...edition, slug }]);
    const ids = Array.from(
      { length: 27 },
      (_, i) => (isMobile ? 896000 : 895000) + i,
    );
    await db()
      .insert(users)
      .values(
        ids.map((id, i) => ({
          osuId: id,
          username: `Stats Player ${String(i).padStart(2, "0")}`,
        })),
      )
      .onConflictDoNothing();
    await db()
      .insert(registrations)
      .values(
        ids.map((id) => ({
          userId: id,
          editionSlug: slug,
          rulesVersion: "test-v1",
          status: "accepted" as const,
          answers: {},
        })),
      )
      .onConflictDoNothing();
    for (const [i, id] of ids.entries()) {
      const profile = normalizeOsuProfile(
        {
          ...profileResponse,
          id,
          statistics: {
            ...profileResponse.statistics,
            global_rank: i ? 1000 + i : null,
            pp: i ? 2000 + i : 0,
          },
        },
        id,
        "osu",
      );
      await db()
        .insert(userProfileCache)
        .values({
          osuId: id,
          mode: "osu",
          profile,
          attemptedAt: new Date(),
          retryAt: new Date(Date.now() + 3600000),
        })
        .onConflictDoUpdate({
          target: [userProfileCache.osuId, userProfileCache.mode],
          set: {
            profile,
            errorStatus: null,
            retryAt: new Date(Date.now() + 3600000),
          },
        });
    }
    await page.goto(`/tournaments/${slug}/players`);
    await expect(page.locator(".event-player-row")).toHaveCount(27);
    await expect(
      page.locator(".event-player-row").first().locator("dd"),
    ).toHaveText(["—", "0"]);
    await expect(
      page.locator(".event-player-row").last().locator("dd"),
    ).toHaveText(["#1,026", "2,026"]);
    await page.reload();
    for (let i = 1; i < 27; i++)
      await expect(
        page.locator(".event-player-row").nth(i).locator("dd"),
      ).toHaveText([
        `#${(1000 + i).toLocaleString("en")}`,
        (2000 + i).toLocaleString("en"),
      ]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("directory-statistics.png"),
    });
  });
});
