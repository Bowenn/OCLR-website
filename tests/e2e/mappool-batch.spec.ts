import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { seedSession } from "./session";
test.describe("bulk mappool operations", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("previews mixed URLs, rejects errors and imports, renumbers, publishes and deletes a batch", async ({
    page,
    context,
    browser,
    isMobile,
  }) => {
    const id = isMobile ? 70001 : 60001;
    await seedSession(id);
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await context.addCookies([await seedSession(id)]);
    const api = "/api/admin/tournaments/test-cup/mappools";
    async function change(data: object) {
      const response = await page.request.post(api, {
        data: { ...data, confirmed: true },
        headers: { Origin: "http://127.0.0.1:3100" },
      });
      expect(response.status()).toBe(200);
      return response.json();
    }
    let data = await change({
      action: "round_create",
      stage: "group",
      name: "Synthetic Bulk Round",
      position: 1,
    });
    data = await change({
      action: "pool_create",
      roundId: data.rounds[0].id,
      name: "Synthetic Bulk Pool",
    });
    const pool = data.pools[0].id;
    await page.goto("/admin/tournaments/test-cup/mappools");
    await page.getByText("Import multiple beatmaps", { exact: true }).click();
    await page
      .getByLabel("Map rows", { exact: true })
      .fill("NM1 123\nNM1 456\nHD1 https://osu.ppy.sh/beatmapsets/42");
    await page
      .getByRole("button", { name: "Preview batch", exact: true })
      .click();
    await expect(
      page.getByRole("table", { name: /Batch preview/ }),
    ).toContainText("Duplicate slot");
    await expect(
      page.getByRole("button", { name: "Import verified batch", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Map rows", { exact: true })
      .fill("NM1 123\nHD1 https://osu.ppy.sh/beatmapsets/42#osu/456");
    await expect(
      page.getByRole("table", { name: /Batch preview/ }),
    ).toHaveCount(0);
    await page
      .getByRole("button", { name: "Preview batch", exact: true })
      .click();
    await expect(
      page.getByRole("table", { name: /Batch preview/ }),
    ).toContainText("Synthetic Replacement Song");
    await page
      .getByRole("button", { name: "Import verified batch", exact: true })
      .click();
    await expect(
      page.getByText("Manage multiple map slots", { exact: true }),
    ).toBeVisible();
    await page.getByText("Manage multiple map slots", { exact: true }).click();
    await page.getByLabel("Select NM1", { exact: true }).check();
    await page.getByLabel("Select HD1", { exact: true }).check();
    await page
      .getByLabel("Move to category", { exact: true })
      .selectOption("DT");
    await page.getByLabel("Starting slot", { exact: true }).fill("3");
    await page
      .getByRole("button", { name: "Move / renumber selected", exact: true })
      .click();
    await expect(page.getByLabel("Select DT3", { exact: true })).toBeAttached();
    await page.getByText("Manage multiple map slots", { exact: true }).click();
    await expect(page.getByLabel("Select DT3", { exact: true })).toBeVisible();
    await expect(page.getByLabel("Select DT4", { exact: true })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);

    await page.getByRole("button", { name: /^DT \(2\)$/ }).click();
    await page.getByText("Edit or replace DT3", { exact: true }).click();
    const editor = page
      .locator("details")
      .filter({ has: page.getByText("Edit or replace DT3", { exact: true }) });
    await editor
      .getByLabel("Difficulty calculation mods", { exact: true })
      .selectOption("DT");
    await expect(editor.getByLabel("Beatmap preview")).toContainText(
      "6.75 ★ official adjusted",
    );
    await editor
      .getByRole("button", { name: "Save map slot", exact: true })
      .click();
    await expect(
      page.getByText("DT · 6.75 ★ official adjusted", { exact: false }).first(),
    ).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath("bulk-mappool-editor.png"),
      fullPage: true,
    });
    data = await (await page.request.get(api)).json();
    data = await change({
      action: "pool_publish",
      poolId: pool,
      expectedVersion: data.pools[0].version,
      published: true,
    });
    const guest = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    try {
      const response = await guest.request.get(
        `/api/tournaments/test-cup/mappools/${pool}`,
      );
      expect(response.status()).toBe(200);
      const published = await response.json();
      expect(published.entries).toHaveLength(2);
      expect(
        published.entries.some(
          (e: { metadata: { attributes?: { stars: number } } }) =>
            e.metadata.attributes?.stars === 6.75,
        ),
      ).toBe(true);
    } finally {
      await guest.close();
    }
    data = await change({
      action: "pool_publish",
      poolId: pool,
      expectedVersion: data.pools[0].version,
      published: false,
    });
    await page.reload();
    await page.getByText("Manage multiple map slots", { exact: true }).click();
    await page.getByLabel("Select DT3", { exact: true }).check();
    await page.getByLabel("Select DT4", { exact: true }).check();
    await page
      .getByRole("button", { name: "Remove selected maps", exact: true })
      .click();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByText("Manage multiple map slots", { exact: true }),
    ).toHaveCount(0);
  });
});
