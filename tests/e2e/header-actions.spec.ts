import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { editionState } from "../../src/db/schema";
import { assertTestDatabase } from "../database";
import prepared from "../../drizzle/legacy-editions.json" with { type: "json" };
import { seedEditions } from "../fixtures/editions";
import { seedSession } from "./session";
import { changeStaffRole } from "../../src/lib/staff-roles";
test.describe("role-aware header actions and compact tournament context", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test.afterEach(async () => {
    if (process.env.TEST_DATABASE_URL) await seedEditions(prepared);
  });
  test("keeps public navigation separate, offers authorized dashboard actions and preserves sidebar context", async ({
    page,
    context,
    browser,
    isMobile,
  }, info) => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    const adminId = isMobile ? 70001 : 60001;
    const playerId = isMobile ? 497102 : 497002;
    const staffId = playerId + 1;
    const adminCookie = await seedSession(adminId);
    const playerCookie = await seedSession(playerId);
    const staffCookie = await seedSession(staffId);
    process.env.ADMIN_OSU_IDS = String(adminId);
    const actor = { osuId: adminId, username: "Synthetic Admin" };
    const grant = await changeStaffRole(actor, {
      action: "grant",
      userId: staffId,
      role: "mappooler",
      editionSlug: "test-cup",
      confirmed: true,
    });
    await page.goto("/");
    const accounts = page.getByRole("group", {
      name: "Account actions",
      exact: true,
    });
    await expect(
      accounts.getByRole("link", { name: "Staff dashboard", exact: true }),
    ).toHaveCount(0);
    await expect(
      accounts.getByRole("link", { name: "Login with osu!", exact: true }),
    ).toBeVisible();
    if (isMobile)
      await page.getByRole("button", { name: "Menu", exact: true }).click();
    const publicNav = page.getByRole("navigation", {
      name: "Main navigation",
      exact: true,
    });
    expect(await publicNav.getByRole("link").allTextContents()).toEqual([
      "Home",
      "Tournaments",
      "Players",
      "News",
      "About",
    ]);
    await expect(publicNav.getByRole("link", { name: /Staff/ })).toHaveCount(0);
    if (isMobile)
      await page.getByRole("button", { name: "Close", exact: true }).click();
    await context.addCookies([playerCookie]);
    await page.reload();
    await expect(
      accounts.getByRole("link", { name: "Dashboard", exact: true }),
    ).toBeVisible();
    await expect(accounts.getByRole("button")).toHaveCount(0);
    await expect(accounts.locator(".avatar")).toHaveCount(1);
    expect((await context.request.get("/api/admin/staff")).status()).toBe(403);
    await accounts
      .getByRole("link", { name: "Dashboard", exact: true })
      .click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(
      accounts.getByRole("link", { name: "Dashboard", exact: true }),
    ).toHaveAttribute("aria-current", "page");
    const staff = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
      viewport: page.viewportSize()!,
    });
    await staff.addCookies([staffCookie]);
    try {
      await staff.route("https://a.ppy.sh/**", (route) => route.abort());
      const operator = await staff.newPage();
      await operator.goto("/");
      const operatorActions = operator.getByRole("group", {
        name: "Account actions",
        exact: true,
      });
      const dashboard = operatorActions.getByRole("button", {
        name: "Dashboard",
        exact: true,
      });
      const menu = operatorActions.getByRole("menu", {
        name: "Dashboards",
        exact: true,
      });
      await expect(dashboard).toHaveAttribute("aria-expanded", "false");
      await expect(operatorActions.locator(".avatar span")).toHaveText("Sy");
      await dashboard.focus();
      await dashboard.press("ArrowDown");
      await expect(menu.getByRole("menuitem")).toHaveText([
        "Player dashboard",
        "Staff dashboard",
      ]);
      await expect(menu.getByRole("menuitem").first()).toBeFocused();
      await operator.keyboard.press("End");
      await expect(menu.getByRole("menuitem").last()).toBeFocused();
      await operator.keyboard.press("ArrowDown");
      await expect(menu.getByRole("menuitem").first()).toBeFocused();
      await operator.keyboard.press("Escape");
      await expect(dashboard).toBeFocused();
      await expect(menu).toHaveCount(0);
      await dashboard.press("ArrowUp");
      await expect(menu.getByRole("menuitem").last()).toBeFocused();
      await operator.keyboard.press("Tab");
      await expect(menu).toHaveCount(0);
      if (isMobile) {
        await operator
          .getByRole("button", { name: "Menu", exact: true })
          .click();
        await dashboard.click();
        await expect(
          operator.getByRole("navigation", {
            name: "Main navigation",
            exact: true,
          }),
        ).toBeHidden();
        await expect(menu).toBeVisible();
        await operator.keyboard.press("Escape");
      }
      await dashboard.click();
      await operator.getByRole("heading", { level: 1 }).click();
      await expect(menu).toHaveCount(0);
      await dashboard.click();
      await menu
        .getByRole("menuitem", { name: "Staff dashboard", exact: true })
        .press(" ");
      await expect(operator).toHaveURL(/\/admin$/);
      await expect(menu).toHaveCount(0);
      await dashboard.click();
      await expect(
        menu.getByRole("menuitem", { name: "Staff dashboard", exact: true }),
      ).toHaveAttribute("aria-current", "page");
      await menu
        .getByRole("menuitem", { name: "Player dashboard", exact: true })
        .press("Enter");
      await expect(operator).toHaveURL(/\/dashboard$/);
      await expect(menu).toHaveCount(0);
      await expect(
        operator
          .getByRole("navigation", { name: "Main navigation", exact: true })
          .locator('[aria-current="page"]'),
      ).toHaveCount(0);
      await changeStaffRole(actor, {
        action: "revoke",
        grantId: grant.id,
        confirmed: true,
      });
      await operator.goto("/");
      await expect(operatorActions.getByRole("button")).toHaveCount(0);
      await expect(
        operatorActions.getByRole("link", { name: "Dashboard", exact: true }),
      ).toBeVisible();
      expect(
        (
          await staff.request.get("/api/admin/tournaments/test-cup/mappools")
        ).status(),
      ).toBe(403);
      await operator.close();
    } finally {
      await staff.close();
    }
    await context.clearCookies();
    await context.addCookies([adminCookie]);
    await page.goto("/admin");
    const appearance = await page.locator("main .button").evaluateAll((nodes) =>
      nodes.map((node) => ({
        height: node.getBoundingClientRect().height,
        font: getComputedStyle(node).fontSize,
      })),
    );
    expect(appearance.length).toBeGreaterThan(3);
    expect(new Set(appearance.map((style) => JSON.stringify(style))).size).toBe(
      1,
    );
    expect(appearance[0].height).toBe(44);
    await page.goto("/admin/tournaments/s11");
    for (const width of [320, 390, 760, 768, 950, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      const control = accounts.getByRole("button", {
        name: "Dashboard",
        exact: true,
      });
      const bounds = (await control.boundingBox())!;
      expect(bounds.x).toBeGreaterThanOrEqual(0);
      // DOMRect transform interpolation can report 43.999999px for a 44px target.
      expect(Math.round(bounds.height * 100) / 100).toBeGreaterThanOrEqual(44);
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
      await expect(accounts.locator(".account-control")).toHaveCount(1);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
      await control.click();
      await expect(accounts.getByRole("menuitem")).toHaveCount(2);
      if (width === 320)
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
      await page.evaluate(() => window.scrollTo(0, 0));
      if ([320, 1440].includes(width))
        await page.screenshot({
          path: info.outputPath(`account-menu-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      await page.keyboard.press("Escape");
    }
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
    const sidebar = page.locator(".sidebar");
    await expect(sidebar.getByLabel("Selected tournament")).toHaveValue("s11");
    await expect(sidebar.locator(".admin-context .sr-only")).toHaveCSS(
      "clip-path",
      "inset(50%)",
    );
    await expect(
      sidebar.locator('.admin-context option[value="s11"]'),
    ).toHaveCount(1);
    expect(
      (await sidebar.locator("p").allTextContents()).filter((text) =>
        /Season 11/.test(text),
      ),
    ).toEqual([]);
    expect(
      (await sidebar.locator(".eyebrow").allTextContents()).filter(
        (text) => text.toLowerCase() === "tournament",
      ),
    ).toHaveLength(1);
    await expect(sidebar.locator(".admin-context .badge")).toHaveText("Draft");
    await db()
      .update(editionState)
      .set({
        configuration: sql`jsonb_set(jsonb_set(configuration, '{published}', 'true'), '{status}', '\"live\"')`,
      })
      .where(eq(editionState.slug, "s11"));
    await page.reload();
    await expect(sidebar.locator(".admin-context .badge")).toHaveText("Live");
    expect(
      await sidebar
        .locator(".admin-context .badge")
        .evaluate((node) => node.closest("a,button") === null),
    ).toBe(true);
    if (isMobile)
      await page
        .getByRole("button", { name: "Open administration menu", exact: true })
        .click();
    const tournamentNav = page.getByRole("navigation", {
      name: "Tournament navigation",
      exact: true,
    });
    await expect(tournamentNav.locator('[aria-current="page"]')).toHaveText(
      "Dashboard",
    );
    await tournamentNav
      .getByRole("link", { name: "Mappools", exact: true })
      .click();
    if (isMobile)
      await page
        .getByRole("button", { name: "Open administration menu", exact: true })
        .click();
    await expect(tournamentNav.locator('[aria-current="page"]')).toHaveText(
      "Mappools",
    );
    const selector = sidebar.getByLabel("Selected tournament");
    const nextValue = await selector
      .locator("option")
      .evaluateAll(
        (options) =>
          (options as HTMLOptionElement[]).find((o) =>
            o.text.startsWith("Synthetic"),
          )!.value,
      );
    await selector.focus();
    await expect(selector).toBeFocused();
    await selector.press("s");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(
      new RegExp(`/admin/tournaments/${nextValue}$`),
    );
    await page.goto("/admin/tournaments/test-cup");
    const publicAction = page.getByRole("link", {
      name: "View public tournament",
      exact: true,
    });
    await expect(publicAction).toHaveClass(/button secondary/);
    const applications = page.getByRole("link", {
      name: "View applications (0)",
      exact: true,
    });
    await expect(applications).toHaveClass(/button secondary/);
    const publicSize = await publicAction.evaluate(
      (node) => node.getBoundingClientRect().height,
    );
    expect(
      await applications.evaluate(
        (node) => node.getBoundingClientRect().height,
      ),
    ).toBe(publicSize);
    expect(
      await page
        .locator(".registration-state")
        .evaluate(
          (node) => node.tagName === "SPAN" && !node.closest("a,button"),
        ),
    ).toBe(true);
    await applications.click();
    await expect(page).toHaveURL(/\/test-cup\/registrations$/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath("dashboard-actions.png"),
      fullPage: true,
    });
  });
});
