import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
test("public pages meet automated WCAG A/AA checks and expose security headers", async ({
  page,
  isMobile,
}) => {
  for (const path of [
    "/",
    "/tournaments",
    "/players",
    "/news",
    "/about",
    "/privacy",
    "/login",
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["content-security-policy"]).toContain(
      "'strict-dynamic'",
    );
    expect(response?.headers()["content-security-policy"]).not.toContain(
      "script-src 'self' 'unsafe-inline'",
    );
    const result = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(result.violations).toEqual([]);
  }
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  if (isMobile) {
    await page.getByRole("button", { name: "Menu", exact: true }).click();
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  }
});
