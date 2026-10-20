import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { editionEvents, users, registrations } from "../../src/db/schema";
import { assertTestDatabase } from "../database";
import { seedSession } from "./session";
test.describe("automatic staff auditing", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("saves captain order, teams and draft setup without reason fields or routine dialogs", async ({
    page,
    context,
    isMobile,
  }) => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    const adminId = isMobile ? 70001 : 60001;
    const base = isMobile ? 341101 : 341001;
    await context.addCookies([await seedSession(adminId)]);
    await db()
      .insert(users)
      .values(
        [0, 1, 2].map((i) => ({
          osuId: base + i,
          username: `Synthetic Setup ${i}`,
        })),
      );
    await db()
      .insert(registrations)
      .values(
        [0, 1, 2].map((i) => ({
          editionSlug: "test-cup",
          userId: base + i,
          status: "accepted" as const,
          rulesVersion: "test-v1",
          answers: {},
        })),
      );
    const captainPage = "/admin/tournaments/test-cup/captains";
    await page.goto(captainPage);
    for (const id of [base, base + 1]) {
      await page
        .getByRole("combobox", { name: /^Player/ })
        .selectOption(String(id));
      const response = page.waitForResponse(
        (r) =>
          r.url().endsWith("/api/admin/tournaments/test-cup/captains") &&
          r.request().method() === "POST",
      );
      await page.getByRole("button", { name: "Save captain setup" }).click();
      expect((await response).status()).toBe(200);
      await expect(page.getByRole("dialog")).toHaveCount(0);
      await expect(page.getByRole("combobox", { name: /^Player/ })).toHaveValue(
        "",
      );
    }
    await page.goto("/admin/tournaments/test-cup/teams");
    await expect(page.getByRole("textbox", { name: /reason/i })).toHaveCount(0);
    const names = page.getByLabel("Approved team name");
    await names.nth(0).fill("Synthetic Setup Team A");
    await names.nth(1).fill("Synthetic Setup Team B");
    await page.getByRole("button", { name: "Save team configuration" }).click();
    await expect(
      page.getByRole("heading", {
        name: "Synthetic Setup Team A",
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await page.goto(captainPage);
    await page.getByRole("combobox", { name: /^Action/ }).selectOption("order");
    await page
      .getByLabel("Captain order (osu! IDs, comma-separated)")
      .fill(`${base + 1}, ${base}`);
    await page.getByRole("button", { name: "Save captain setup" }).click();
    await expect(page.getByRole("combobox", { name: /^Action/ })).toHaveValue(
      "appoint",
    );
    await page.getByRole("combobox", { name: /^Action/ }).selectOption("lock");
    await page.getByRole("button", { name: "Review setup change" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.getByRole("button", { name: "Confirm", exact: true }).click();
    await expect(
      page.getByText("Setup locked", { exact: false }),
    ).toBeVisible();
    await page.goto("/admin/tournaments/test-cup/draft");
    await expect(page.getByRole("textbox", { name: /reason/i })).toHaveCount(0);
    await page.getByRole("button", { name: "Append captain order" }).click();
    await page.getByRole("button", { name: "Remove turn 2" }).click();
    await page.getByRole("button", { name: "Save turn sequence" }).click();
    await expect(
      page.getByRole("button", { name: "Freeze draft setup" }),
    ).toBeVisible();
    const events = await db().select().from(editionEvents);
    expect(events).toHaveLength(6);
    for (const event of events) {
      expect(event.actorId).toBe(adminId);
      expect(event.reason).toBeNull();
      expect(event.createdAt).toBeInstanceOf(Date);
      expect(event.detail).toHaveProperty("entity");
      expect(event.detail).toHaveProperty("before");
      expect(event.detail).toHaveProperty("after");
    }
    expect(events.map((e) => e.kind)).toEqual(
      expect.arrayContaining([
        "captain_appoint",
        "team_configure",
        "captain_order",
        "captain_lock",
        "draft_configure",
      ]),
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
});
