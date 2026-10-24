import { test, expect } from "@playwright/test";
test("S11 artwork preserves its mobile composition while tournament information stays unpublished", async ({
  page,
  context,
  isMobile,
}, info) => {
  await page.goto("/");
  await expect(page.locator(".home-full-name")).toHaveText(
    "osu! Chinese League Rookie",
  );
  await expect(page.locator(".home-full-name")).not.toContainText("SEASON 11");
  await expect(page.locator(".hero-art")).toHaveCSS(
    "background-image",
    /rookie-stage\.svg/,
  );
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page.locator("#hero-title img")).toBeVisible();
  }
  await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 900 });
  await page.screenshot({
    path: info.outputPath("season-11-home.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/tournaments");
  await expect(page.getByRole("link", { name: /OCLR Season 11/ })).toHaveCount(
    0,
  );
  for (const path of [
    "",
    "/rules",
    "/register",
    "/schedule",
    "/mappools",
    "/results",
    "/bracket",
  ]) {
    await page.goto(`/tournaments/s11${path}`);
    await expect(
      page.getByRole("heading", { name: "Off the beat." }),
    ).toBeVisible();
  }
  expect(
    await (await context.request.get("/api/tournaments/s11/mappools")).json(),
  ).toEqual([]);
  expect(
    (await context.request.get("/api/tournaments/s11/matches")).status(),
  ).toBe(404);
  expect(
    (await context.request.get("/api/tournaments/s11/bracket")).status(),
  ).toBe(404);
  expect(
    (await (await context.request.get("/api/players?edition=s11")).json()).rows,
  ).toEqual([]);
});
