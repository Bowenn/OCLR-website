import {
  expect,
  test,
  type Browser,
  type BrowserContext,
  type Page,
} from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { createSession } from "../../src/lib/auth/sessions";
import { draftPicks } from "../../src/db/schema";
import { prepareDraft } from "../fixtures/draft";
const testUrl = process.env.TEST_DATABASE_URL;
test.describe("isolated multi-captain rehearsal", () => {
  test.skip(!testUrl, "Requires isolated PostgreSQL");
  test.setTimeout(90000);
  const contexts: BrowserContext[] = [];
  test.beforeAll(() => {
    if (!new URL(testUrl!).pathname.includes("test"))
      throw new Error("Isolated database required");
    process.env.DATABASE_URL = testUrl;
    process.env.STAFF_OSU_IDS = "110001,120001";
  });
  test.beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
  });
  test.afterEach(async () => {
    for (const context of contexts.splice(0)) await context.close();
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
  });
  test.afterAll(async () => closeDb());
  async function actor(browser: Browser, id: number | null, mobile: boolean) {
    const context = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1280, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    context.setDefaultTimeout(10000);
    contexts.push(context);
    if (id) {
      const session = await createSession(id);
      await context.addCookies([
        {
          name: "oclr_session",
          value: session.token,
          domain: "127.0.0.1",
          path: "/",
          httpOnly: true,
          sameSite: "Lax",
        },
      ]);
    }
    return { context, page: await context.newPage() };
  }
  async function publish(
    page: Page,
    reason = "Synthetic rehearsal approved publication.",
  ) {
    await page
      .getByLabel("Operator reason / publication approval")
      .fill(reason);
    await page
      .getByRole("button", { name: "Publish current state", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      page.getByText("Committed changes await publication.", { exact: false }),
    ).toHaveCount(0);
  }
  test("captain-direct and staff-on-behalf picks converge only after publication and survive reconnect", async ({
    browser,
    isMobile,
  }, testInfo) => {
    const slug = isMobile ? "draft-mobile-test" : "draft-desktop-test";
    const base = isMobile ? 120001 : 110001;
    const fixture = await prepareDraft(slug, base);
    const a = await actor(browser, fixture.a.osuId, isMobile);
    const b = await actor(browser, fixture.b.osuId, isMobile);
    const staff = await actor(browser, fixture.staff.osuId, isMobile);
    const spectator = await actor(browser, null, isMobile);
    await a.page.goto(`/tournaments/${slug}/draft/captain`);
    await b.page.goto(`/tournaments/${slug}/draft/captain`);
    await staff.page.goto(`/admin/tournaments/${slug}/draft`);
    await spectator.page.goto(`/tournaments/${slug}/draft`);
    await expect(
      a.page.getByRole("button", { name: "Confirm Pick", exact: true }),
    ).toBeVisible();
    await expect(
      b.page.getByRole("button", { name: "Confirm Pick", exact: true }),
    ).toHaveCount(0);
    const initial = await (
      await b.context.request.get(`/api/tournaments/${slug}/draft/captain`)
    ).json();
    expect(
      (
        await b.context.request.post(`/api/tournaments/${slug}/draft/picks`, {
          headers: { origin: "http://127.0.0.1:3100" },
          data: {
            sessionId: initial.sessionId,
            turnIndex: initial.turnIndex,
            expectedVersion: initial.engineRevision,
            candidateId: fixture.players[0].osuId,
            idempotencyKey: crypto.randomUUID(),
          },
        })
      ).status(),
    ).toBe(403);
    expect(
      (
        await spectator.context.request.post(
          `/api/tournaments/${slug}/draft/picks`,
          { headers: { origin: "http://127.0.0.1:3100" }, data: {} },
        )
      ).status(),
    ).toBe(401);
    expect(
      (
        await a.context.request.get(`/api/admin/tournaments/${slug}/draft`)
      ).status(),
    ).toBe(403);
    await a.page
      .getByLabel("Eligible player", { exact: true })
      .selectOption(String(fixture.players[0].osuId));
    await a.page
      .getByRole("button", { name: "Confirm Pick", exact: true })
      .click();
    await a.page
      .getByRole("button", { name: "Commit pick", exact: true })
      .click();
    await expect(a.page.getByText(/Pick committed to/).first()).toBeVisible();
    await expect(
      staff.page.getByText("Committed changes await publication.", {
        exact: false,
      }),
    ).toBeVisible();
    expect(
      (
        await (
          await spectator.context.request.get(`/api/tournaments/${slug}/draft`)
        ).json()
      ).picks,
    ).toHaveLength(0);
    await expect(
      b.page.getByRole("button", { name: "Confirm Pick", exact: true }),
    ).toHaveCount(0);
    await publish(staff.page);
    await expect(spectator.page.locator(".draft-picks > li")).toHaveCount(1);
    await expect(
      b.page.getByRole("button", { name: "Confirm Pick", exact: true }),
    ).toBeVisible();
    await staff.page
      .getByLabel("Eligible player", { exact: true })
      .selectOption(String(fixture.players[1].osuId));
    await staff.page
      .getByRole("button", {
        name: `Select for Captain ${fixture.b.username}`,
        exact: true,
      })
      .click();
    await staff.page
      .getByRole("button", { name: "Commit pick", exact: true })
      .click();
    await expect(
      staff.page.getByText("Committed changes await publication.", {
        exact: false,
      }),
    ).toBeVisible();
    await expect(spectator.page.locator(".draft-picks > li")).toHaveCount(1);
    await publish(staff.page);
    await expect(spectator.page.locator(".draft-picks > li")).toHaveCount(2);
    await expect(
      spectator.page.locator(".draft-picks > li").last(),
    ).toContainText(fixture.b.username);
    await expect(
      spectator.page.locator(".draft-picks > li").last(),
    ).not.toContainText(fixture.staff.username);
    await spectator.context.setOffline(true);
    await expect(
      spectator.page.getByRole("status").filter({ hasText: "Reconnecting" }),
    ).toBeVisible({ timeout: 7000 });
    await spectator.context.setOffline(false);
    await expect(
      spectator.page.getByRole("status").filter({ hasText: "Connected" }),
    ).toBeVisible({ timeout: 7000 });
    await spectator.page.reload();
    await expect(spectator.page.locator(".draft-picks > li")).toHaveCount(2);
    expect(await db().select().from(draftPicks)).toHaveLength(2);
    await staff.page
      .getByLabel("Operator reason / publication approval")
      .fill("Synthetic final roster integrity review.");
    await staff.page
      .getByRole("button", { name: "Finalize rosters", exact: true })
      .click();
    await staff.page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(
      staff.page.getByText("Rosters finalized", { exact: true }),
    ).toBeVisible();
    await publish(staff.page);
    await expect(
      spectator.page.getByText("Rosters finalized", { exact: true }),
    ).toBeVisible();
    for (const [page, name] of [
      [a.page, "captain"],
      [staff.page, "draft-control"],
      [spectator.page, "draft-public"],
    ] as const) {
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
      await page.evaluate(() => {
        window.scrollTo(0, 0);
        if (document.activeElement instanceof HTMLElement)
          document.activeElement.blur();
      });
      await page.screenshot({
        path: testInfo.outputPath(`${name}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
    await spectator.page.goto(`/tournaments/${slug}/draft?presenter=1`);
    await expect(spectator.page.locator(".site-header")).toBeHidden();
    await expect(spectator.page.locator(".draft-picks > li")).toHaveCount(2);
    const payload = JSON.stringify(
      await (
        await spectator.context.request.get(`/api/tournaments/${slug}/draft`)
      ).json(),
    );
    for (const forbidden of [
      "actorId",
      "requestKey",
      "staff_on_behalf",
      fixture.staff.username,
    ])
      expect(payload).not.toContain(forbidden);
  });
  test("competing UI confirmations commit once and clear stale selections", async ({
    browser,
    isMobile,
  }) => {
    const slug = isMobile ? "draft-mobile-test" : "draft-desktop-test";
    const fixture = await prepareDraft(slug, isMobile ? 120001 : 110001);
    const a = await actor(browser, fixture.a.osuId, isMobile);
    const staff = await actor(browser, fixture.staff.osuId, isMobile);
    await a.page.goto(`/tournaments/${slug}/draft/captain`);
    await staff.page.goto(`/admin/tournaments/${slug}/draft`);
    await a.page
      .getByLabel("Eligible player", { exact: true })
      .selectOption(String(fixture.players[0].osuId));
    await staff.page
      .getByLabel("Eligible player", { exact: true })
      .selectOption(String(fixture.players[1].osuId));
    await a.page
      .getByRole("button", { name: "Confirm Pick", exact: true })
      .click();
    await staff.page
      .getByRole("button", {
        name: `Select for Captain ${fixture.a.username}`,
        exact: true,
      })
      .click();
    await Promise.all([
      a.page.getByRole("button", { name: "Commit pick", exact: true }).click(),
      staff.page
        .getByRole("button", { name: "Commit pick", exact: true })
        .click(),
    ]);
    await expect
      .poll(async () => (await db().select().from(draftPicks)).length)
      .toBe(1);
    await expect
      .poll(
        async () =>
          (await a.page.locator("main").innerText()) +
          (await staff.page.locator("main").innerText()),
      )
      .toContain("Draft state changed");
    await expect(
      staff.page.getByText("Committed changes await publication.", {
        exact: false,
      }),
    ).toBeVisible();
    const cancel = staff.page
      .locator("dialog[open]")
      .getByRole("button", { name: "Cancel", exact: true });
    if (await cancel.count()) await cancel.click();
    await publish(staff.page);
    await expect(
      staff.page.getByRole("button", {
        name: `Select for Captain ${fixture.b.username}`,
        exact: true,
      }),
    ).toBeVisible();
    await expect(
      staff.page.getByLabel("Eligible player", { exact: true }),
    ).toHaveValue("");
  });
});
