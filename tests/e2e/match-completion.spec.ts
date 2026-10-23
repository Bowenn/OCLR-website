import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { fixtures, matchImports, matchResults } from "../../src/db/schema";
import { seedSession } from "./session";
import { seedBrowserEditions } from "./setup";
import { seedResultReview } from "../fixtures/results";
import { assertTestDatabase } from "../database";
import { fixtureCommand } from "../../src/lib/fixtures";
test.describe("historical MP completion", () => {
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
  });
  test.afterEach(seedBrowserEditions);
  test.afterAll(closeDb);
  test("previews a TBD match, confirms teams and enters private normal review without changing schedule", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const actor = {
      osuId: isMobile ? 70001 : 60001,
      username: "Synthetic Admin",
    };
    const adminCookie = await seedSession(actor.osuId);
    await seedSession(60101);
    await context.addCookies([adminCookie]);
    const seeded = await seedResultReview(actor.osuId, 60101, 1331000);
    const old = seeded.context.fixture;
    const workspace = await fixtureCommand(actor, "test-cup", {
      action: "create",
      confirmed: true,
      label: "Keep historical label",
      roundId: old.roundId,
      homeTeamId: null,
      awayTeamId: null,
      mappoolId: old.mappoolId,
      position: 2,
      scheduledAt: "2026-01-01T12:00:00Z",
      timeZone: "UTC",
      status: "scheduled",
      homeSourceId: null,
      homeSourceOutcome: null,
      awaySourceId: null,
      awaySourceOutcome: null,
      refereeIds: [],
    });
    const fixture = workspace.fixtures.find((f) => f.position === 2)!;
    await page.goto(`/admin/tournaments/test-cup/matches/${fixture.id}`);
    await page
      .getByLabel("osu! MP link or match ID", { exact: true })
      .fill("https://osu.ppy.sh/community/matches/999133");
    await page
      .getByRole("button", { name: "Preview MP source", exact: true })
      .click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic historical lobby",
        exact: true,
      }),
    ).toBeVisible();
    expect(
      new Set([
        await page.getByLabel("Home team", { exact: true }).inputValue(),
        await page.getByLabel("Away team", { exact: true }).inputValue(),
      ]),
    ).toEqual(new Set([seeded.home.teamId, seeded.away.teamId]));
    expect(
      await db()
        .select()
        .from(matchImports)
        .where(eq(matchImports.fixtureId, fixture.id)),
    ).toHaveLength(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: info.outputPath("private-completion-preview.png"),
      fullPage: true,
    });
    await page
      .getByRole("button", {
        name: "Confirm teams & import source",
        exact: true,
      })
      .click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText("Keep historical label");
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    expect(
      (await db().select().from(fixtures).where(eq(fixtures.id, fixture.id)))[0]
        .homeTeamId,
    ).toBeNull();
    await page
      .getByRole("button", {
        name: "Confirm teams & import source",
        exact: true,
      })
      .click();
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Review every game", exact: true }),
    ).toBeVisible();
    const [saved] = await db()
      .select()
      .from(fixtures)
      .where(eq(fixtures.id, fixture.id));
    expect(saved.label).toBe("Keep historical label");
    expect(saved.scheduledAt).toEqual(new Date("2026-01-01T12:00:00Z"));
    const [report] = await db()
      .select()
      .from(matchResults)
      .where(eq(matchResults.fixtureId, fixture.id));
    expect(report.publishedRevision).toBeNull();
  });
});
