import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { seedSession } from "./session";
import { db, closeDb } from "../../src/db";
import { registrations } from "../../src/db/schema";
test.describe("staff registration review", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("denies nonstaff and lets authorized staff review and export", async ({
    page,
    context,
    isMobile,
    browser,
  }, testInfo) => {
    const staffId = isMobile ? 70001 : 60001;
    const playerId = staffId + 1;
    const staffCookie = await seedSession(staffId);
    const playerCookie = await seedSession(playerId);
    const [record] = await db()
      .insert(registrations)
      .values({
        userId: playerId,
        editionSlug: "test-cup",
        rulesVersion: "test-v1",
        answers: { private: "Private test answer" },
      })
      .returning();
    const other = await browser.newContext();
    await other.addCookies([playerCookie]);
    for (const route of [
      "/api/admin/registrations",
      "/api/admin/registrations/export",
    ])
      expect(
        (await other.request.get(`http://127.0.0.1:3100${route}`)).status(),
      ).toBe(403);
    expect(
      (
        await other.request.post(
          `http://127.0.0.1:3100/api/admin/registrations/${record.id}/review`,
          {
            headers: { origin: "http://127.0.0.1:3100" },
            data: {
              status: "accepted",
              confirmed: true,
              expectedUpdatedAt: record.updatedAt.toISOString(),
            },
          },
        )
      ).status(),
    ).toBe(403);
    await context.addCookies([staffCookie]);
    await page.goto("/admin/registrations");
    if (!isMobile)
      await expect(
        page
          .getByRole("group", { name: "Account actions" })
          .getByRole("link", { name: "Staff dashboard", exact: true }),
      ).toBeVisible();
    if (!isMobile) {
      const original = page.viewportSize()!;
      for (const width of [320, 768, 1024]) {
        await page.setViewportSize({ width, height: 900 });
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(width);
      }
      await page.setViewportSize(original);
    }
    await page.getByLabel("Search player or osu! ID").fill(String(playerId));
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await expect(
      page.getByRole("cell", {
        name: `Synthetic Player ${playerId}`,
        exact: true,
      }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <= window.innerWidth &&
          window.innerWidth <= window.screen.width,
      ),
    ).toBeTruthy();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath("admin.png"),
      fullPage: true,
      animations: "disabled",
    });
    await page
      .getByRole("link", {
        name: new RegExp(`Review Synthetic Player ${playerId}`),
      })
      .click();
    await expect(
      page.getByText("Private test answer", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Review decision" }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.locator("section .badge").first()).toHaveText("accepted");
    const csv = await context.request.get(
      `/api/admin/registrations/export?q=${playerId}`,
    );
    expect(csv.status()).toBe(200);
    const content = await csv.text();
    expect(content).toContain("accepted");
    expect(content).not.toContain("Private test answer");
    const own = await other.request.get(
      "http://127.0.0.1:3100/api/registrations",
    );
    expect((await own.json())[0].status).toBe("accepted");
    await other.close();
  });
});
