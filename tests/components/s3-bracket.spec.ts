import { expect, test } from "@playwright/test";
test("S3 separates 20 preliminaries and displays all ten knockout matches with twelve reference paths", async ({
  page,
}, testInfo) => {
  await page.goto("/s3-bracket");
  await expect(page.locator(".match-card")).toHaveCount(10);
  await page.getByRole("button", { name: "Knockout", exact: true }).click();
  await expect(page.locator(".bracket-scroll .match-card")).toHaveCount(10);
  await expect(page.locator(".bracket-connectors path")).toHaveCount(12);
  await expect(page.locator('[data-match-id="ko-a10"]')).toContainText("7");
  await page.screenshot({
    path: testInfo.outputPath("light.png"),
    fullPage: true,
  });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.screenshot({
    path: testInfo.outputPath("dark.png"),
    fullPage: true,
  });
});
