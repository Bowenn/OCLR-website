import { test, expect } from "@playwright/test";
import { db, closeDb } from "../../src/db";
import { users, registrations } from "../../src/db/schema";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
test.afterAll(closeDb);
test("all players appear without pagination while offscreen messages wait", async ({
  page,
  isMobile,
}, info) => {
  const base = isMobile ? 926000 : 925000;
  const slug = `complete-${base}-test`;
  await seedEditions([{ ...edition, slug }]);
  const ids = Array.from({ length: 61 }, (_, i) => base + i);
  await db()
    .insert(users)
    .values(ids.map((osuId) => ({ osuId, username: `Complete ${osuId}` })))
    .onConflictDoNothing();
  await db()
    .insert(registrations)
    .values(
      ids.map((userId, i) => ({
        userId,
        editionSlug: slug,
        status: i === 60 ? ("pending" as const) : ("accepted" as const),
        answers: {},
      })),
    )
    .onConflictDoNothing();
  const loads = new Set<string>();
  await page.route(
    `**/api/tournaments/${slug}/players/*/messages`,
    async (route) => {
      loads.add(route.request().url());
      await route.fulfill({ json: [] });
    },
  );
  await page.goto(`/tournaments/${slug}/players?page=2`);
  const rows = page.locator(".event-player-row");
  await expect(rows).toHaveCount(60);
  await expect(
    page.getByRole("navigation", { name: "Player directory pages" }),
  ).toHaveCount(0);
  await expect(rows.first()).toContainText(String(base));
  await expect(rows.last()).toContainText(String(base + 59));
  await expect.poll(() => loads.size).toBeGreaterThan(0);
  expect(loads.size).toBeLessThan(60);
  await rows.last().scrollIntoViewIfNeeded();
  await expect
    .poll(() => [...loads].some((url) => url.includes(`/${base + 59}/`)))
    .toBe(true);
  await expect(page.locator(".edition-players")).not.toContainText(
    String(base + 60),
  );
  await page.screenshot({ path: info.outputPath("complete-directory.png") });
  await page.goto(`/tournaments/${slug}/players?q=${base + 59}`);
  await expect(rows).toHaveCount(1);
});
