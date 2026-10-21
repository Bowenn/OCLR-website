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
    // Continue keyboard navigation from the visible skip link. Clicking through
    // that focused overlay is not an operable path and can obscure the Menu.
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "OCLR home" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(
      page.getByRole("button", { name: "Menu", exact: true }),
    ).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("navigation", { name: "Main navigation" }),
    ).toBeVisible();
  }
});
test("public shell reflows at narrow and intermediate viewport widths", async ({
  page,
}) => {
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width);
    await expect(page.getByRole("link", { name: "OCLR home" })).toBeVisible();
  }
});
