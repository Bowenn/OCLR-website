import { expect, test } from "@playwright/test";
test("S5 separates 24 preliminaries and displays all ten knockout matches with twelve reference paths", async ({
  page,
}, testInfo) => {
  await page.goto("/s5-bracket");
  await expect(page.locator(".match-card")).toHaveCount(24);
  await page.getByRole("button", { name: "Knockout", exact: true }).click();
  await expect(page.locator(".bracket-library-scroll .match-card")).toHaveCount(
    10,
  );
  await page.getByText("Connection sources", { exact: true }).click();
  await expect(page.locator(".bracket-source-details li")).toHaveCount(12);
  await expect(page.locator('[data-match-id="gf"]')).toContainText("7");
  await page.screenshot({
    path: testInfo.outputPath("light.png"),
    fullPage: true,
  });
  await page.evaluate(() => (document.documentElement.dataset.theme = "dark"));
  await page.screenshot({
    path: testInfo.outputPath("dark.png"),
    fullPage: true,
  });
  await page.getByRole("checkbox").uncheck();
  await expect(page.locator(".bracket-library-scroll")).toHaveClass(
    /bracket-library-no-lines/,
  );
  await page.getByRole("checkbox").check();
  await expect(page.locator(".bracket-library-scroll")).not.toHaveClass(
    /bracket-library-no-lines/,
  );
});
