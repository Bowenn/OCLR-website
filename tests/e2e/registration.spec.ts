import { expect, test } from "@playwright/test";
import { seedSession } from "./session";
import { closeDb } from "../../src/db";
test.describe("player registration with persistent sessions", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("applies, sees only own saved data and withdraws with confirmation", async ({
    page,
    context,
    isMobile,
    browser,
  }, testInfo) => {
    const id = isMobile ? 40001 : 30001;
    await context.addCookies([await seedSession(id)]);
    await page.goto("/dashboard");
    await expect(page.getByText("Your stage starts here.")).toBeVisible();
    await page.goto("/tournaments/test-cup/register");
    await page.getByLabel(/I have read and agree/).check();
    await page.getByLabel(/I have read the eligibility/).check();
    await page
      .getByRole("button", { name: "Submit individual application" })
      .click();
    await expect(page).toHaveURL(/\/dashboard\?submitted=1$/);
    await expect(page.locator(".registration-card .badge")).toHaveText(
      "pending",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBeTruthy();
    const other = await browser.newContext();
    await other.addCookies([await seedSession(id + 1)]);
    const privateResponse = await other.request.get(
      "http://127.0.0.1:3100/api/registrations",
    );
    expect(await privateResponse.json()).toEqual([]);
    await other.close();
    await page.screenshot({
      path: `/private/tmp/oclr-dashboard-${testInfo.project.name}.png`,
      fullPage: true,
      animations: "disabled",
    });
    await page.getByRole("button", { name: "Withdraw application" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Cancel", exact: true }).click();
    await expect(page.locator(".registration-card .badge")).toHaveText(
      "pending",
    );
    await page.getByRole("button", { name: "Withdraw application" }).click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(page.locator(".registration-card .badge")).toHaveText(
      "withdrawn",
    );
    await page.getByRole("button", { name: "Sign out", exact: true }).click();
    await expect(page).toHaveURL(/\/login\?loggedOut=1$/);
    expect((await context.request.get("/api/registrations")).status()).toBe(
      401,
    );
  });
});
