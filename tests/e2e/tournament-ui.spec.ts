import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedSession } from "./session";
import { db, closeDb } from "../../src/db";
import { editionState } from "../../src/db/schema";
import { eq } from "drizzle-orm";
test.describe("registration readiness and confirmation layout", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("centers confirmation and error dialogs, explains blockers and schedules future entry", async ({
    page,
    context,
    browser,
    isMobile,
  }, info) => {
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    const slug = isMobile ? "ui-mobile-test" : "ui-desktop-test";
    await db().delete(editionState).where(eq(editionState.slug, slug));
    const endpoint = `/api/admin/tournaments/${slug}`;
    const headers = { origin: "http://127.0.0.1:3100" };
    const current = async () => (await context.request.get(endpoint)).json();
    const create = await context.request.post("/api/admin/tournaments", {
      headers,
      data: {
        slug,
        name: "Synthetic UI tournament",
        season: null,
        summary: "Isolated UI test only.",
        timeZone: "Asia/Taipei",
        branding: { logo: null, background: null, keyVisual: null },
        confirmed: true,
      },
    });
    expect(create.status()).toBe(201);
    const command = async (action: string, fields: object) => {
      const data = await current();
      const result = await context.request.post(endpoint, {
        headers,
        data: {
          action,
          confirmed: true,
          expectedRevision: data.revision,
          ...fields,
        },
      });
      expect(result.ok()).toBe(true);
    };
    await page.goto(`/admin/tournaments/${slug}/settings?section=publication`);
    await page
      .getByRole("button", { name: "Publish tournament", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    const centered = async () => {
      await expect(dialog).toBeVisible();
      const bounds = (await dialog.boundingBox())!;
      const viewport = page.viewportSize()!;
      expect(
        Math.abs(bounds.x + bounds.width / 2 - viewport.width / 2),
      ).toBeLessThan(2);
      expect(
        Math.abs(bounds.y + bounds.height / 2 - viewport.height / 2),
      ).toBeLessThan(2);
      expect(bounds.x).toBeGreaterThanOrEqual(15);
      expect(bounds.y).toBeGreaterThanOrEqual(15);
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(
        viewport.height - 15,
      );
    };
    await centered();
    const state = await current();
    const { name, summary, season, branding, timeZone, status } = state.edition;
    await command("general", {
      name,
      summary: summary + " Updated.",
      season,
      branding,
      timeZone,
      status,
    });
    await dialog.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(dialog.getByRole("alert")).toContainText("settings changed");
    await centered();
    await page.screenshot({
      path: info.outputPath("centered-error-dialog.png"),
      fullPage: true,
    });
    await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
    const now = Date.now();
    await command("registration", {
      registration: {
        enabled: false,
        opensAt: new Date(now + 3600000).toISOString(),
        closesAt: new Date(now + 7200000).toISOString(),
        withdrawUntil: null,
        questions: [],
      },
    });
    await command("publication", { published: true });
    await page.goto(`/admin/tournaments/${slug}/settings?section=registration`);
    await expect(
      page.getByRole("checkbox", {
        name: "Enable registration during this window",
        exact: true,
      }),
    ).toBeEnabled();
    await expect(
      page.getByText("Before enabling registration", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("checkbox", {
        name: "Enable registration during this window",
        exact: true,
      })
      .check();
    const save = page.getByRole("button", {
      name: "Save registration settings",
      exact: true,
    });
    await save.click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole("status")).toContainText("saved");
    const publicState = await (
      await context.request.get(`/api/tournaments/${slug}`)
    ).json();
    expect(publicState.registration.state).toBe("upcoming");
    await page.goto(`/admin/tournaments/${slug}`);
    const readiness = page.getByRole("region", {
      name: "Registration",
      exact: true,
    });
    await expect(readiness.locator("li")).toHaveCount(3);
    await expect(
      readiness.getByText("upcoming", { exact: true }),
    ).toBeVisible();
    await expect(readiness.getByText("Opens", { exact: true })).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath("compact-tournament-dashboard.png"),
      fullPage: true,
    });
    await command("registration", {
      registration: {
        enabled: true,
        opensAt: new Date(now - 3600000).toISOString(),
        closesAt: new Date(now + 7200000).toISOString(),
        withdrawUntil: null,
        questions: [],
      },
    });
    const player = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    try {
      await player.addCookies([await seedSession(isMobile ? 355102 : 355002)]);
      const applicant = await player.newPage();
      await applicant.goto(`/tournaments/${slug}/register`);
      await expect(applicant.getByRole("checkbox")).toHaveCount(0);
      await expect(
        applicant.getByRole("link", { name: "privacy notice", exact: true }),
      ).toBeVisible();
      await applicant
        .getByRole("button", { name: "Submit individual application" })
        .click();
      await expect(applicant).toHaveURL(/dashboard\?submitted=1$/);
      await expect(
        applicant.getByText("No rules were configured when you applied.", {
          exact: false,
        }),
      ).toBeVisible();
      await command("rules", {
        rules: {
          version: "later-v1",
          sections: [
            { heading: "Later rules", body: "Synthetic later rules." },
          ],
        },
        eligibility: "Synthetic later eligibility.",
      });
      await applicant.reload();
      await expect(
        applicant.getByText("No rules were configured when you applied.", {
          exact: false,
        }),
      ).toBeVisible();
    } finally {
      await player.close();
    }
  });
});
