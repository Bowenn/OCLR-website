import { test, expect } from "@playwright/test";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import archive from "../../docs/imports/s10-archive.json" with { type: "json" };

test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
test.afterAll(closeDb);
test("S10 corrected names are stored literally and preserve pool navigation", async ({
  page,
  context,
  isMobile,
}, info) => {
  test.setTimeout(60000);
  const slug = `issue-261-${isMobile ? "mobile" : "desktop"}`;
  await seedEditions([
    {
      ...edition,
      slug,
      status: "completed",
      registration: null,
      archive: { ...archive, editionSlug: slug },
    },
  ]);
  const stored = await db().execute(
    sql`SELECT configuration#>'{archive,pools}' AS pools FROM edition_state WHERE slug=${slug}`,
  );
  expect(stored.rows[0].pools).toEqual(archive.pools);
  for (const theme of ["light", "dark"]) {
    await context.addCookies([
      { name: "oclr-theme", value: theme, url: "http://127.0.0.1:3100" },
    ]);
    await page.goto(`/tournaments/${slug}/mappools`);
    const stages = page.getByRole("navigation", { name: "Mappool stages" });
    await expect(stages.locator("a > span:first-child")).toHaveText([
      "Group Stage 1",
      "Group Stage 2",
      "Semifinals",
      "Finals",
      "Grand Finals",
    ]);
    for (const pool of archive.pools) {
      const link = stages.locator(
        `a[href="/tournaments/${slug}/mappools/${pool.id}"]`,
      );
      await expect(link.locator(".archive-pool-count")).toHaveText(
        String(pool.maps.length),
      );
      await link.click();
      await expect(page).toHaveURL(new RegExp(`/mappools/${pool.id}$`));
      await expect(link).toHaveAttribute("aria-current", "page");
      await expect(
        page.getByRole("group", {
          name: `${pool.name}: map view`,
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.locator(".pool-summary")).toContainText(
        `${pool.maps.length} / ${pool.maps.length} maps`,
      );
    }
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath(`s10-pool-names-${theme}.png`),
      fullPage: false,
    });
  }
});
