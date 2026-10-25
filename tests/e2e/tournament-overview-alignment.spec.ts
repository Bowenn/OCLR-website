import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { readFileSync } from "node:fs";
import { closeDb } from "../../src/db";
test.describe("tournament overview alignment (#265)", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("shares the handbook, preserves anchors and uses open headers in every appearance", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await seedEditions([
      {
        ...edition,
        slug: "overview-test",
        branding: {
          ...edition.branding,
          background: "/oclr-s11-website-background.webp",
        },
      },
    ]);
    await seedEditions([
      {
        ...edition,
        slug: "s10",
        season: "10",
        name: "OCLR Season 10",
        status: "completed",
        registration: null,
        archive: JSON.parse(
          readFileSync("docs/imports/s10-archive.json", "utf8"),
        ),
      },
    ]);
    for (const appearance of ["default", "cute-pastel", "swiss-minimal"]) {
      for (const theme of ["light", "dark"]) {
        await context.addCookies([
          {
            name: "oclr-appearance",
            value: appearance,
            url: "http://127.0.0.1:3100",
          },
          { name: "oclr-theme", value: theme, url: "http://127.0.0.1:3100" },
        ]);
        for (const slug of ["overview-test", "s10"]) {
          await page.goto(`/tournaments/${slug}`);
          if (slug === "overview-test") {
            await expect(
              page.locator(
                ".information-page .rules-reading > .information-heading",
              ),
            ).toBeVisible();
            await expect(
              page.locator(
                ".information-page .rules-reading > .information-banner",
              ),
            ).toBeVisible();
            await expect(page.locator(".information-contents")).toHaveCount(0);
            const banner = await page
              .locator(".information-banner")
              .boundingBox();
            if (!isMobile) {
              const index = await page
                .locator(".information-page .rules-desktop-contents")
                .boundingBox();
              expect(index!.x).toBeGreaterThanOrEqual(
                banner!.x + banner!.width,
              );
              expect(index!.y).toBeLessThan(banner!.y);
            } else {
              const index = await page
                .locator(".information-page .rules-mobile-contents")
                .boundingBox();
              expect(index!.y + index!.height).toBeLessThan(banner!.y);
            }
            await expect(
              page.locator(
                '#organization, #links, a[href="#organization"], a[href="#links"]',
              ),
            ).toHaveCount(0);
            await expect(page.locator("#rules .rules-article")).toContainText(
              edition.eligibility!,
            );
            await expect(page.locator("#rules .rules-article")).toContainText(
              edition.rules!.sections[0].body,
            );
          } else {
            await expect(page.locator(".archive-counts > div")).toHaveCount(5);
            await expect(page.locator("#rules .rules-article")).toBeVisible();
          }
          expect(
            await page.evaluate(
              () => document.documentElement.scrollWidth <= innerWidth,
            ),
          ).toBe(true);
          if (isMobile)
            await page.getByRole("button", { name: /Tournament menu/ }).click();
          const links = page
            .getByRole("navigation", { name: "Tournament navigation" })
            .getByRole("link");
          await expect(links.last()).toHaveText("Rules");
          await expect(links.last()).toHaveAttribute(
            "href",
            `/tournaments/${slug}/rules`,
          );
          if (isMobile)
            await page.getByRole("button", { name: /Tournament menu/ }).click();
          expect(
            (
              await new AxeBuilder({ page })
                .withTags(["wcag2a", "wcag2aa"])
                .analyze()
            ).violations,
          ).toEqual([]);
          await page.screenshot({
            path: info.outputPath(`${slug}-${appearance}-${theme}.png`),
            fullPage: true,
          });
        }
      }
    }
    // The annotated report used a ~650px viewport: keep its index beside the banner.
    await page.setViewportSize({ width: 647, height: 900 });
    await page.goto("/tournaments/overview-test");
    const tabletBanner = await page
      .locator(".information-banner")
      .boundingBox();
    const tabletIndex = await page
      .locator(".information-page .rules-desktop-contents")
      .boundingBox();
    expect(tabletIndex!.x).toBeGreaterThanOrEqual(
      tabletBanner!.x + tabletBanner!.width,
    );
    expect(tabletIndex!.y).toBeLessThan(tabletBanner!.y);
    await expect(page.locator(".rules-mobile-contents")).toBeHidden();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const stage = page.locator(".stage-scroll-row.is-current");
    const face = await stage.locator(".stage-scroll-face").boundingBox();
    const copy = await stage.locator(".stage-scroll-copy").boundingBox();
    const action = await stage.locator(".stage-scroll-action").boundingBox();
    expect(copy!.y).toBeGreaterThanOrEqual(face!.y);
    expect(action!.y).toBeGreaterThanOrEqual(copy!.y + copy!.height);
    expect(action!.y + action!.height).toBeLessThanOrEqual(
      face!.y + face!.height,
    );
    await page.screenshot({
      path: info.outputPath("overview-tablet-right-index.png"),
      fullPage: true,
    });
    await page.locator('.rules-desktop-contents a[href="#rules-2"]').click();
    await expect(page.locator("#rules-2")).toBeInViewport();
    await page.goto("/tournaments/overview-test#rules-2");
    await expect(page.locator("#rules-2")).toBeInViewport();
    await page.goto("/tournaments/s10/rules");
    await expect(page.locator(".rules-handbook")).toBeVisible();
  });
});
