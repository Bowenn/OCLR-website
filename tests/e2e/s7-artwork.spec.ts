import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { seedSession } from "./session";

test.describe("S7 organizer artwork", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("saves original artwork and renders the full banner in the directory and archive", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const slug = `s7-artwork-${isMobile ? "mobile" : "desktop"}`;
    const archive = historicalArchiveSchema.parse({
      ...JSON.parse(readFileSync("docs/imports/s7-archive.json", "utf8")),
      editionSlug: slug,
    });
    await seedEditions([
      {
        ...edition,
        slug,
        name: "S7 artwork verification",
        status: "completed",
        registration: null,
        archive,
      },
    ]);
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    await page.goto(`/admin/tournaments/${slug}/settings`);
    await page
      .getByRole("combobox", { name: "Square logo", exact: true })
      .selectOption("/archive/s7/key-visual.jpg");
    await page
      .getByRole("combobox", { name: "Key visual", exact: true })
      .selectOption("/archive/s7/key-visual.jpg");
    await page
      .getByRole("button", { name: "Save general settings", exact: true })
      .click();
    await expect(page.getByRole("status")).toContainText("saved");
    await page.reload();
    await expect(
      page.getByRole("combobox", { name: "Key visual", exact: true }),
    ).toHaveValue("/archive/s7/key-visual.jpg");
    const saved = await (
      await context.request.get(`/api/admin/tournaments/${slug}`)
    ).json();
    expect(saved.edition.archive).toEqual(archive);
    expect(saved.edition.published).toBe(true);
    await context.clearCookies();
    await context.addCookies([
      { name: "oclr-locale", value: "en", domain: "127.0.0.1", path: "/" },
    ]);
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
        await page.setViewportSize({
          width: isMobile ? 390 : 1440,
          height: 1000,
        });
        await page.goto("/tournaments");
        const card = page
          .locator(".edition-card")
          .filter({ has: page.locator(`a[href="/tournaments/${slug}"]`) });
        const thumbnail = card.locator(".edition-art img");
        await expect(thumbnail).toHaveJSProperty("naturalWidth", 1920);
        const bounds = (await thumbnail.boundingBox())!;
        expect(bounds.width / bounds.height).toBeCloseTo(16 / 9, 2);
        await page.goto(`/tournaments/${slug}`);
        const banner = page.getByRole("img", {
          name: "S7 artwork verification key visual",
          exact: true,
        });
        await expect(banner).toHaveAttribute(
          "src",
          "/archive/s7/key-visual.jpg",
        );
        await expect(banner).toHaveJSProperty("naturalWidth", 1920);
        const image = (await banner.boundingBox())!;
        expect(image.width / image.height).toBeCloseTo(16 / 9, 2);
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
        ).toBeLessThanOrEqual(isMobile ? 390 : 1440);
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
        await page.screenshot({
          path: info.outputPath(`s7-artwork-${appearance}-${theme}.png`),
          fullPage: true,
        });
      }
    await page.goto(`/tournaments/${slug}/schedule`);
    await expect(page.locator(".edition-key-visual")).toHaveCount(0);
  });
});
