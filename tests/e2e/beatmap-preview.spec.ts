import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  mappools,
  mappoolEntries,
  mappoolEvents,
  tournamentStages,
  tournamentRounds,
  staffRoles,
} from "../../src/db/schema";
import { seedSession } from "./session";
test.describe("automatic beatmap preview boundaries", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("cancels stale previews, handles provider errors and preserves saved records on failed or concurrent saves", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const id = isMobile ? 201101 : 201001;
    await context.addCookies([await seedSession(id)]);
    await db().insert(staffRoles).values({
      userId: id,
      role: "mappooler",
      editionSlug: "test-cup",
      grantedBy: id,
    });
    await db().execute(sql`TRUNCATE tournament_stages CASCADE`);
    const [stage] = await db()
      .insert(tournamentStages)
      .values({ editionSlug: "test-cup", kind: "knockout" })
      .onConflictDoUpdate({
        target: [tournamentStages.editionSlug, tournamentStages.kind],
        set: { kind: "knockout" },
      })
      .returning();
    const [round] = await db()
      .insert(tournamentRounds)
      .values({
        editionSlug: "test-cup",
        stageId: stage.id,
        name: "Synthetic preview round",
        position: isMobile ? 91 : 90,
      })
      .returning();
    const [pool] = await db()
      .insert(mappools)
      .values({
        editionSlug: "test-cup",
        roundId: round.id,
        name: "Synthetic Preview Pool",
      })
      .returning();
    const url = "/api/admin/tournaments/test-cup/mappools";
    const headers = { origin: "http://127.0.0.1:3100" };
    const lookup = (beatmap: string) =>
      context.request.post(`${url}/preview`, { headers, data: { beatmap } });
    const first = await (await lookup("123")).json();
    const second = await (await lookup("456")).json();
    expect(
      (await (await lookup("https://osu.ppy.sh/beatmaps/123")).json())
        .fetchedAt,
    ).toBe(first.fetchedAt);
    let release!: () => void;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    const calls: number[] = [];
    await page.route(`**${url}/preview`, async (route) => {
      const value = Number(route.request().postDataJSON().beatmap);
      calls.push(value);
      if (value === 123) await delayed;
      await route
        .fulfill({ json: value === 123 ? first : second })
        .catch(() => {}); // An aborted stale request may already be closed.
    });
    await page.goto("/admin/tournaments/test-cup/mappools");
    await page
      .getByRole("tab", { name: "Knockout Stage", exact: true })
      .click();
    await page.getByRole("button", { name: round.name, exact: true }).click();
    await page
      .getByRole("button", { name: "Add a NM beatmap", exact: true })
      .click();
    const input = page.getByRole("textbox", {
      name: "Beatmap URL or ID",
      exact: true,
    });
    const add = page.getByRole("button", { name: "Add beatmap", exact: true });
    await input.fill("1");
    await input.fill("12");
    await input.fill("123");
    await expect.poll(() => calls).toEqual([123]);
    await input.fill("456");
    await expect(add).toBeDisabled();
    await expect(
      page
        .getByLabel("Beatmap preview")
        .getByRole("link", { name: /Synthetic Replacement Song/ }),
    ).toBeVisible();
    release();
    await expect(page.getByLabel("Beatmap preview")).not.toContainText(
      "Synthetic Browser Song",
    );
    expect(calls).toEqual([123, 456]);
    // Same ID in canonical URL form reuses the current preview rather than issuing another request.
    await input.fill("https://osu.ppy.sh/beatmaps/456");
    await expect(add).toBeEnabled();
    expect(calls).toEqual([123, 456]);
    await page.unroute(`**${url}/preview`);
    await input.fill("https://evil.example/456");
    await expect(page.locator("main").getByRole("alert")).toContainText(
      "official osu! difficulty URL",
    );
    await expect(page.getByLabel("Beatmap preview")).toHaveCount(0);
    await expect(add).toBeDisabled();
    // These errors come from the real API route and shared client using test-only provider transport fixtures.
    for (const [value, message] of [
      ["999", /unavailable or deleted/],
      ["888", /rate limit/],
      ["777", /could not return/],
      ["666", /incomplete beatmap metadata/],
      ["555", /temporarily unreachable/],
    ] as const) {
      await input.fill(value);
      await expect(page.locator("main").getByRole("alert")).toContainText(
        message,
      );
      await expect(add).toBeDisabled();
      await expect(
        page.getByRole("button", { name: "Retry beatmap lookup" }),
      ).toBeVisible();
    }
    await input.fill("456");
    await expect(add).toBeEnabled();
    await page
      .getByRole("spinbutton", { name: "Slot number", exact: true })
      .fill("3");
    await page.screenshot({
      path: info.outputPath("beatmap-preview.png"),
      fullPage: true,
      animations: "disabled",
    });
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
    await add.click();
    await expect(
      page.getByRole("button", { name: "NM (1)", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".mappool-inline-editor")).toHaveCount(0);
    await page
      .getByRole("button", { name: "Add a NM beatmap", exact: true })
      .click();
    await expect(
      page.getByRole("spinbutton", { name: "Slot number", exact: true }),
    ).toHaveValue("4");
    const [saved] = await db()
      .select()
      .from(mappoolEntries)
      .where(eq(mappoolEntries.poolId, pool.id));
    expect(saved).toMatchObject({
      beatmapId: 456,
      position: 3,
      metadata: second.metadata,
    });
    const count = (
      await db()
        .select()
        .from(mappoolEvents)
        .where(eq(mappoolEvents.poolId, pool.id))
    ).length;
    for (const action of ["entry_save", "entry_refresh"]) {
      if (action === "entry_refresh")
        await db()
          .update(mappoolEntries)
          .set({ beatmapId: 999, metadataFetchedAt: new Date(0) })
          .where(eq(mappoolEntries.id, saved.id));
      const response = await context.request.post(url, {
        headers,
        data: {
          action,
          confirmed: true,
          poolId: pool.id,
          expectedVersion: 1,
          entryId: saved.id,
          ...(action === "entry_save"
            ? { beatmap: "999", category: "NM", position: 3 }
            : {}),
        },
      });
      expect(response.status()).toBe(404);
      expect(
        (
          await db()
            .select()
            .from(mappoolEntries)
            .where(eq(mappoolEntries.id, saved.id))
        )[0].metadata,
      ).toEqual(second.metadata);
      expect(
        (
          await db()
            .select()
            .from(mappoolEvents)
            .where(eq(mappoolEvents.poolId, pool.id))
        ).length,
      ).toBe(count);
    }
    await db()
      .update(mappoolEntries)
      .set({ beatmapId: 456, metadataFetchedAt: saved.metadataFetchedAt })
      .where(eq(mappoolEntries.id, saved.id));
    const writes = await Promise.all(
      [4, 5].map((position) =>
        context.request.post(url, {
          headers,
          data: {
            action: "entry_save",
            confirmed: true,
            poolId: pool.id,
            expectedVersion: 1,
            entryId: saved.id,
            beatmap: "123",
            category: "NM",
            position,
          },
        }),
      ),
    );
    expect(writes.map((r) => r.status()).sort()).toEqual([200, 409]);
    expect(
      (
        await db()
          .select()
          .from(mappoolEvents)
          .where(eq(mappoolEvents.poolId, pool.id))
      ).length,
    ).toBe(count + 1);
    await db()
      .update(staffRoles)
      .set({ revokedAt: new Date() })
      .where(eq(staffRoles.userId, id));
    expect((await lookup("123")).status()).toBe(403);
  });
});
