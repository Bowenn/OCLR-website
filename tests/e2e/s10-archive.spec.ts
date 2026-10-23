import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { closeDb } from "../../src/db";
import { seedSession } from "./session";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";

test.describe("S10 archive handoff", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.setTimeout(120000);
  test.afterAll(async () => closeDb());
  test("imports the actual package privately, publishes explicitly and renders S10 original content", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const slug = `s10-${isMobile ? "mobile" : "desktop"}-${Date.now()}`;
    const archive = historicalArchiveSchema.parse({
      ...JSON.parse(readFileSync("docs/imports/s10-archive.json", "utf8")),
      editionSlug: slug,
    });
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    await seedEditions([
      {
        ...edition,
        slug,
        name: "S10 archive verification",
        season: "10",
        published: false,
        status: "completed",
        registration: null,
      },
    ]);
    await page.goto(`/admin/tournaments/${slug}/archive`);
    await page
      .getByLabel("Archive JSON file", { exact: true })
      .setInputFiles({
        name: "s10-archive.json",
        mimeType: "application/json",
        buffer: Buffer.from(JSON.stringify(archive)),
      });
    await page
      .getByRole("button", { name: "Validate and review archive" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Review source records" }),
    ).toBeVisible();
    await page
      .getByRole("button", { name: "Save archive draft", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("Archive draft saved");
    const endpoint = `/api/admin/tournaments/${slug}`;
    const saved = await (await context.request.get(endpoint)).json();
    expect(saved.edition.archive).toEqual(archive);
    expect(saved.edition.published).toBe(false);
    expect(
      (await context.request.get(`/tournaments/${slug}/rules`)).status(),
    ).toBe(404);
    await page.goto(`/admin/tournaments/${slug}/archive/preview?section=rules`);
    await expect(page.locator(".rules-article > section")).toHaveCount(7);
    await expect(page.locator(".rules-article")).toContainText(
      "1. 没有教练，别想了。",
    );
    await page.goto(`/admin/tournaments/${slug}/settings?tab=publication`);
    await page.getByRole("tab", { name: "Publication", exact: true }).click();
    await page
      .getByRole("button", { name: "Publish tournament", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Confirm", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await (await context.request.get(endpoint)).json()).edition
            .published,
      )
      .toBe(true);
    await context.clearCookies();
    await context.addCookies([
      { name: "oclr-locale", value: "en", domain: "127.0.0.1", path: "/" },
    ]);
    await page.setViewportSize({ width: isMobile ? 390 : 1440, height: 1000 });
    for (const appearance of ["default", "cute-pastel", "swiss-minimal"])
      for (const theme of ["light", "dark"]) {
        await context.addCookies([
          {
            name: "oclr-appearance",
            value: appearance,
            domain: "127.0.0.1",
            path: "/",
          },
          { name: "oclr-theme", value: theme, domain: "127.0.0.1", path: "/" },
        ]);
        for (const path of ["schedule", "mappools", "rules"]) {
          await page.goto(`/tournaments/${slug}/${path}`);
          if (path === "schedule") {
            await expect(page.locator(".archive-match")).toHaveCount(30);
            await expect(page.locator(".historical-archive")).toContainText(
              "UTC+8",
            );
            await expect(
              page.getByRole("button", { name: /Unconfirmed records/ }),
            ).toHaveCount(0);
          } else if (path === "mappools") {
            await expect(
              page
                .getByRole("navigation", { name: "Mappool stages" })
                .getByRole("link"),
            ).toHaveCount(5);
            await expect(page.locator(".archive-map-item")).toHaveCount(19);
          } else {
            await expect(page.locator(".rules-article > section")).toHaveCount(
              7,
            );
            await expect(page.locator(".rules-version")).toHaveText(
              "7 sections",
            );
            await expect(page.locator(".rules-article")).not.toContainText(
              "v1.2",
            );
            await expect(page.locator(".rules-illustration img")).toHaveCount(
              2,
            );
          }
          await expect(page.locator(".historical-archive")).not.toContainText(
            "Mappools!",
          );
          expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
            [],
          );
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(isMobile ? 390 : 1440);
          await page.screenshot({
            path: info.outputPath(`${appearance}-${theme}-${path}.png`),
            fullPage: false,
          });
        }
      }
    for (const image of await page.locator(".rules-illustration img").all()) {
      await image.scrollIntoViewIfNeeded();
      await expect
        .poll(() =>
          image.evaluate((img) => (img as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
    }
    await page.screenshot({
      path: info.outputPath("s10-rule-diagram.png"),
      fullPage: false,
    });
    for (const pool of archive.pools) {
      await page.goto(`/tournaments/${slug}/mappools/${pool.id}`);
      await expect(page.locator(".archive-map-item")).toHaveCount(
        pool.maps.length,
      );
    }
    await page.goto(`/tournaments/${slug}/players`);
    await expect(page.locator(".archive-player-card")).toHaveCount(80);
    await expect(page.locator('[data-role="coach"]')).toHaveCount(0);
    await page
      .getByRole("searchbox", { name: "Search players", exact: true })
      .fill("14912108");
    await expect(page.locator(".archive-player-card")).toHaveCount(1);
    await expect(page.locator(".archive-player-card")).toContainText("koutya_");
    await page.goto(`/tournaments/${slug}/draft`);
    await expect(page.locator(".archive-draft-picks li")).toHaveCount(70);
    await page.goto(`/tournaments/${slug}/staff`);
    await expect(
      page.locator(".archive-staff .public-staff-list > li"),
    ).toHaveCount(15);
    for (const match of archive.matches.filter((m) => m.score === null))
      expect(
        (
          await context.request.get(`/tournaments/${slug}/matches/${match.id}`)
        ).status(),
      ).toBe(404);
    expect((await context.request.get(endpoint)).status()).toBe(401);
  });
});
