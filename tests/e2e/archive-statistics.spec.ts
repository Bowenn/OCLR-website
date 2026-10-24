import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { statisticsArchive } from "../fixtures/archive-statistics";
import { seedSession } from "./session";
import { closeDb } from "../../src/db";
test.describe("historical statistics review and public exploration", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.setTimeout(120000);
  test.afterAll(async () => closeDb());
  test("imports MP, reviews warmups/replays, publishes and explores S7–S10", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const seasons = ["s7", "s8", "s9", "s10"];
    await seedEditions(
      seasons.map((slug) => ({
        ...edition,
        slug,
        name: "Synthetic " + slug.toUpperCase() + " statistics",
        status: "completed",
        registration: null,
        published: true,
        archive: { ...statisticsArchive, editionSlug: slug },
      })),
    );
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    // Each project uses a fresh edition row but can share an earlier published snapshot.
    const { db } = await import("../../src/db");
    const { historicalStatistics } = await import("../../src/db/schema");
    const { inArray } = await import("drizzle-orm");
    await db()
      .delete(historicalStatistics)
      .where(inArray(historicalStatistics.editionSlug, seasons));
    await page.goto("/admin/tournaments/s7/statistics");
    await page
      .getByRole("button", { name: /Import missing MP histories/ })
      .click();
    await expect(page.getByRole("status")).toContainText("Import complete", {
      timeout: 30000,
    });
    await page.getByLabel("Match", { exact: true }).selectOption("one");
    await expect(
      page.getByRole("heading", { name: "MP 999177", exact: true }),
    ).toBeVisible();
    const guest = await context.browser()!.newContext();
    await guest.addCookies([
      { name: "oclr-locale", value: "en", domain: "127.0.0.1", path: "/" },
    ]);
    const guestPage = await guest.newPage();
    await guestPage.goto("http://127.0.0.1:3100/tournaments/s7/statistics");
    await expect(
      guestPage.getByText("Statistics have not been published yet.", {
        exact: true,
      }),
    ).toBeVisible();
    expect(
      (
        await guest.request.get(
          "http://127.0.0.1:3100/api/admin/tournaments/s7/statistics",
        )
      ).status(),
    ).toBe(401);
    await guest.close();
    await expect(
      page.getByRole("checkbox", { name: "Include game 3", exact: true }),
    ).toBeDisabled();
    await page
      .getByRole("button", { name: "Select eligible games", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Save statistics review", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText(
      "Statistics draft saved.",
    );
    await expect(
      page.getByRole("button", {
        name: "Approve & publish statistics",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("checkbox", { name: "Include game 4", exact: true })
      .uncheck();
    await page
      .getByRole("button", { name: "Save statistics review", exact: true })
      .click();
    await expect(
      page.getByRole("button", {
        name: "Approve & publish statistics",
        exact: true,
      }),
    ).toBeEnabled();
    await page
      .getByRole("button", {
        name: "Approve & publish statistics",
        exact: true,
      })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByRole("dialog")).not.toBeVisible();
    // Publish the same synthetic evidence through the authenticated, origin-protected API for each remaining edition.
    for (const slug of seasons.slice(1)) {
      const api = "/api/admin/tournaments/" + slug + "/statistics";
      const headers = { Origin: "http://127.0.0.1:3100" };
      expect(
        (
          await context.request.post(api, {
            headers,
            data: { action: "import", mpId: 999177, expectedVersion: 0 },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await context.request.post(api, {
            headers,
            data: {
              action: "review",
              mpId: 999177,
              expectedVersion: 1,
              poolId: "final",
              included: [1, 2],
            },
          })
        ).ok(),
      ).toBe(true);
      expect(
        (
          await context.request.post(api, {
            headers,
            data: {
              action: "publish",
              fixtureId: "one",
              expectedVersions: { "999177": 2 },
              confirmed: true,
            },
          })
        ).ok(),
      ).toBe(true);
    }
    expect(
      (
        await context.request.post("/api/admin/tournaments/s7/statistics", {
          headers: { Origin: "https://wrong.example" },
          data: { action: "import", mpId: 999177, expectedVersion: 3 },
        })
      ).status(),
    ).toBe(403);
    await context.clearCookies();
    await context.addCookies([
      { name: "oclr-locale", value: "en", domain: "127.0.0.1", path: "/" },
    ]);
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 950 });
    for (const slug of seasons) {
      for (const appearance of ["default", "cute-pastel", "swiss-minimal"])
        for (const theme of ["light", "dark"]) {
          await context.addCookies([
            {
              name: "oclr-appearance",
              value: appearance,
              domain: "127.0.0.1",
              path: "/",
            },
            {
              name: "oclr-theme",
              value: theme,
              domain: "127.0.0.1",
              path: "/",
            },
          ]);
          await page.goto("/tournaments/" + slug + "/statistics");
          await expect(page.locator(".statistics-table tbody tr")).toHaveCount(
            4,
          );
          await expect(page.locator(".statistics-summary")).toContainText(
            "1 / 1",
          );
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(isMobile ? 390 : 1440);
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          if (slug === "s7")
            await page.screenshot({
              path: info.outputPath(appearance + "-" + theme + ".png"),
              fullPage: true,
            });
        }
    }
    await page.getByRole("searchbox").fill("91003");
    await expect(page.locator(".statistics-table tbody tr")).toHaveCount(1);
    await page.getByRole("button", { name: /Historical Player/ }).click();
    await expect(page.locator(".statistics-detail tbody tr")).toHaveCount(2);
    await expect(page.locator(".statistics-detail")).toContainText(
      "90 / 5 / 2 / 3",
    );
    await page.getByRole("button", { name: "Final", exact: true }).click();
    await expect(page.locator(".statistics-detail tbody tr")).toHaveCount(2);
    for (const locale of ["zh-Hans", "zh-Hant"]) {
      await context.addCookies([
        { name: "oclr-locale", value: locale, domain: "127.0.0.1", path: "/" },
      ]);
      await page.reload();
      await expect(
        page.getByRole("heading", {
          name: locale === "zh-Hant" ? "選手統計" : "选手统计",
          exact: true,
        }),
      ).toBeVisible();
    }
  });
});
