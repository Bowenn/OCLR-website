import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { fixtureReferees, staffRoles } from "../../src/db/schema";
import { seedSession } from "./session";
import { seedPublicDirectory } from "../fixtures/players";
import { mappoolCommand } from "../../src/lib/mappools";
test.describe("staff fixtures and referee assignments over HTTP", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("admin schedules, configures rules and assigns a referee without exposing private fixture data", async ({
    page,
    context,
    browser,
    isMobile,
  }, info) => {
    const url = process.env.TEST_DATABASE_URL!;
    if (!new URL(url).pathname.includes("test"))
      throw new Error("Use a test database");
    process.env.DATABASE_URL = url;
    await db().execute(sql`TRUNCATE tournament_stages CASCADE`);
    const adminId = isMobile ? 70001 : 60001;
    const refId = isMobile ? 275102 : 275002;
    const mapperId = refId + 1;
    const base = isMobile ? 270101 : 270001;
    const home = await seedPublicDirectory(base);
    const away = await seedPublicDirectory(base + 10);
    await context.addCookies([await seedSession(adminId)]);
    const refCookie = await seedSession(refId);
    const mapperCookie = await seedSession(mapperId);
    await db()
      .insert(staffRoles)
      .values([
        {
          userId: refId,
          role: "referee",
          editionSlug: "test-cup",
          grantedBy: adminId,
        },
        {
          userId: mapperId,
          role: "mappooler",
          editionSlug: "test-cup",
          grantedBy: adminId,
        },
      ]);
    process.env.ADMIN_OSU_IDS = String(adminId);
    let maps = await mappoolCommand(
      { osuId: adminId, username: "Synthetic Admin" },
      "test-cup",
      {
        action: "round_create",
        stage: "group",
        name: `Synthetic Fixture Round ${base}`,
        position: isMobile ? 802 : 801,
        confirmed: true,
        reason: "Synthetic fixture setup",
      },
    );
    const round = maps.rounds.find(
      (r) => r.name === `Synthetic Fixture Round ${base}`,
    )!;
    maps = await mappoolCommand(
      { osuId: adminId, username: "Synthetic Admin" },
      "test-cup",
      {
        action: "pool_create",
        roundId: round.id,
        name: `Synthetic Fixture Pool ${base}`,
        confirmed: true,
        reason: "Synthetic fixture setup",
      },
    );
    const pool = maps.pools.find((p) => p.roundId === round.id)!;
    const referee = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    const guest = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    const mapper = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    await referee.addCookies([refCookie]);
    await mapper.addCookies([mapperCookie]);
    const endpoint = "/api/admin/tournaments/test-cup/matches";
    const headers = { origin: "http://127.0.0.1:3100" };
    try {
      expect((await guest.request.get(endpoint)).status()).toBe(401);
      expect((await mapper.request.get(endpoint)).status()).toBe(403);
      expect(
        (
          await referee.request.post(endpoint, {
            headers,
            data: { confirmed: true },
          })
        ).status(),
      ).toBe(403);
      expect(
        (await (await referee.request.get(endpoint)).json()).fixtures,
      ).toEqual([]);
      await page.goto("/admin/tournaments/test-cup/matches");
      await page
        .getByLabel("Reason for fixture changes")
        .fill("Synthetic fixture scheduling approval");
      await page.getByText("Create a fixture", { exact: true }).click();
      await page
        .getByLabel("Fixture label", { exact: true })
        .fill(`Synthetic HTTP Fixture ${base}`);
      await page
        .getByRole("combobox", { name: /^Competition round/ })
        .selectOption(round.id);
      await page
        .getByRole("combobox", { name: /^Home team/ })
        .selectOption(home.teamId);
      await page
        .getByRole("combobox", { name: /^Away team/ })
        .selectOption(away.teamId);
      await page
        .getByRole("combobox", { name: /^Associated mappool/ })
        .selectOption(pool.id);
      await page
        .getByLabel("Assigned referee osu! IDs (comma-separated)")
        .fill(String(refId));
      await page
        .getByRole("button", { name: "Create fixture", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByRole("heading", {
          name: `Synthetic HTTP Fixture ${base} ↗`,
          exact: true,
        }),
      ).toBeVisible();
      const data = await (await context.request.get(endpoint)).json();
      const fixture = data.fixtures.find(
        (f: { label: string }) => f.label === `Synthetic HTTP Fixture ${base}`,
      );
      expect(fixture.scheduledAt).toBeNull();
      expect(fixture.publishedAt).toBeNull();
      expect(fixture.result).toBeNull();
      expect(
        (await referee.request.get(`${endpoint}/${fixture.id}`)).status(),
      ).toBe(200);
      expect(
        (await mapper.request.get(`${endpoint}/${fixture.id}`)).status(),
      ).toBe(403);
      expect(
        (await guest.request.get(`${endpoint}/${fixture.id}`)).status(),
      ).toBe(401);
      const operation = {
        requestKey: randomUUID(),
        expectedVersion: 0,
        expectedFixtureVersion: fixture.version,
        confirmed: true,
        reason: "Synthetic direct API permission rehearsal",
      };
      const reportUrl = `${endpoint}/${fixture.id}/results`;
      const importUrl = `${endpoint}/${fixture.id}/imports`;
      expect((await guest.request.get(reportUrl)).status()).toBe(401);
      expect((await mapper.request.get(reportUrl)).status()).toBe(403);
      expect((await referee.request.get(reportUrl)).status()).toBe(200);
      expect(
        (
          await guest.request.post(importUrl, {
            headers,
            data: { ...operation, match: "999001" },
          })
        ).status(),
      ).toBe(401);
      expect(
        (
          await mapper.request.post(importUrl, {
            headers,
            data: { ...operation, match: "999001" },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await referee.request.post(reportUrl, {
            headers,
            data: { ...operation, action: "approve", revision: 1 },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await referee.request.post(importUrl, {
            headers,
            data: { ...operation, match: "999001" },
          })
        ).status(),
      ).toBe(503);
      const afterUnavailable = await (
        await referee.request.get(reportUrl)
      ).json();
      expect(afterUnavailable.context.result).toBeNull();
      expect(afterUnavailable.source).toBeNull();
      await page
        .getByText(`${round.name}: approved competition rules`, { exact: true })
        .click();
      const rules = page.locator("details").filter({
        has: page.locator("summary", {
          hasText: `${round.name}: approved competition rules`,
        }),
      });
      await rules.getByLabel("Configure approved scoring rules").check();
      await rules
        .getByLabel("Approved scoring rules version")
        .fill("synthetic-http-v1");
      await rules
        .getByRole("combobox", { name: /^Game mode/ })
        .selectOption("osu");
      await rules
        .getByRole("combobox", { name: /^Multiplayer team mode/ })
        .selectOption("team-vs");
      await rules
        .getByRole("combobox", { name: /^Scoring type/ })
        .selectOption("score");
      await rules
        .getByRole("combobox", { name: /^Team score aggregation/ })
        .selectOption("sum");
      await rules.getByLabel("Players per team per game").fill("2");
      await rules
        .getByRole("combobox", { name: /^Series format/ })
        .selectOption("first_to");
      await rules.getByLabel("Map wins required").fill("2");
      await rules
        .getByRole("combobox", { name: /^Failed player scores/ })
        .selectOption("include");
      await rules
        .getByRole("combobox", { name: /^Tied map policy/ })
        .selectOption("require_replay");
      await rules
        .getByRole("combobox", { name: /^Understrength teams/ })
        .selectOption("false");
      await rules
        .getByRole("combobox", { name: /^Substitution policy/ })
        .selectOption("false");
      await rules
        .getByRole("button", { name: "Save approved round rules" })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const review = await (
        await referee.request.get(`${endpoint}/${fixture.id}`)
      ).json();
      expect(review.round.scoringRules).toMatchObject({
        version: "synthetic-http-v1",
        series: { type: "first_to", wins: 2 },
        playersPerTeam: 2,
      });
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
        path: info.outputPath("fixtures.png"),
        fullPage: true,
        animations: "disabled",
      });
      await page
        .getByRole("button", { name: "Publish fixture", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByText("Published fixture", { exact: true }),
      ).toBeVisible();
      expect(
        (
          await context.request.post(endpoint, {
            data: {
              action: "publish",
              fixtureId: fixture.id,
              expectedVersion: 1,
              published: false,
              reason: "No CSRF origin",
              confirmed: true,
            },
          })
        ).status(),
      ).toBe(403);
      await db()
        .delete(fixtureReferees)
        .where(eq(fixtureReferees.fixtureId, fixture.id));
      expect(
        (await referee.request.get(`${endpoint}/${fixture.id}`)).status(),
      ).toBe(403);
      expect(
        (await (await referee.request.get(endpoint)).json()).fixtures,
      ).toEqual([]);
    } finally {
      await referee.close();
      await guest.close();
      await mapper.close();
    }
  });
});
