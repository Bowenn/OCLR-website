import { test, expect } from "@playwright/test";
for (const theme of ["light", "dark"]) {
  test(`notes open and dismiss without hiding status (${theme})`, async ({
    page,
  }) => {
    await page.goto("/info-note");
    await page
      .locator("html")
      .evaluate((el, value) => el.setAttribute("data-theme", value), theme);
    const trigger = page
      .getByRole("button", { name: "Notes", exact: true })
      .first();
    const content = page.getByText("Supplementary explanation");
    await expect(content).not.toBeVisible();
    await expect(page.getByRole("status")).toBeVisible();
    await trigger.focus();
    await page.keyboard.press("Enter");
    await expect(content).toBeVisible();
    const box = await page
      .locator(".profile-info-popover:popover-open")
      .boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    await page.keyboard.press("Escape");
    await expect(content).not.toBeVisible();
    await trigger.click();
    await page.getByRole("heading").click();
    await expect(content).not.toBeVisible();
    await page
      .getByRole("button", { name: "Notes", exact: true })
      .last()
      .click();
    await expect(page.getByText("Coverage details")).toBeVisible();
  });
}
