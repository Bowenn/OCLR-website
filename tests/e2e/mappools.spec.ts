import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { seedSession } from "./session";
import { db, closeDb } from "../../src/db";
import {
  mappools,
  mappoolEntries,
  mappoolEvents,
  staffRoles,
} from "../../src/db/schema";
test.describe("published mappools and restricted editing", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("Mappooler configures FM and slots, anonymous visitors see only released maps", async ({
    page,
    context,
    browser,
    isMobile,
  }, info) => {
    const id = isMobile ? 200101 : 200001;
    const adminId = isMobile ? 70001 : 60001;
    const cookie = await seedSession(id);
    await db().execute(sql`TRUNCATE tournament_stages CASCADE`);
    await seedSession(adminId);
    await db().insert(staffRoles).values({
      userId: id,
      role: "mappooler",
      editionSlug: "test-cup",
      grantedBy: adminId,
    });
    await context.addCookies([cookie]);
    const refereeId = id + 1;
    const refCookie = await seedSession(refereeId);
    await db().insert(staffRoles).values({
      userId: refereeId,
      role: "referee",
      editionSlug: "test-cup",
      grantedBy: adminId,
    });
    const guest = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    const referee = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    await referee.addCookies([refCookie]);
    const url = "/api/admin/tournaments/test-cup/mappools";
    const headers = { origin: "http://127.0.0.1:3100" };
    try {
      expect((await guest.request.get(url)).status()).toBe(401);
      expect((await referee.request.get(url)).status()).toBe(403);
      expect(
        (
          await referee.request.post(url, {
            headers,
            data: { confirmed: true },
          })
        ).status(),
      ).toBe(403);
      await page.goto("/admin/tournaments/test-cup/mappools");
      await page.getByText("Create a round", { exact: true }).click();
      await page
        .getByLabel("Round name", { exact: true })
        .fill("Synthetic Group Round");
      await page
        .getByRole("button", { name: "Create round", exact: true })
        .click();
      await expect(
        page.getByRole("combobox", { name: /^Round/ }),
      ).toContainText("Synthetic Group Round");
      await page.getByText("Create a mappool", { exact: true }).click();
      await page.getByLabel("New pool name").fill("Synthetic Browser Pool");
      await page.getByRole("button", { name: "Create draft pool" }).click();
      await expect(
        page.getByRole("heading", { name: "Synthetic Browser Pool" }),
      ).toBeVisible();
      await page.getByText("Pool name and FM policy", { exact: true }).click();
      await page
        .getByRole("combobox", { name: /^FM policy/ })
        .selectOption("force_mod");
      await page
        .getByLabel("Approved FM restrictions")
        .fill("Synthetic test restrictions — not tournament rules");
      await page.getByRole("button", { name: "Save pool settings" }).click();
      await expect(page.getByText("Draft · v1", { exact: true })).toBeVisible();
      const data = await (await context.request.get(url)).json();
      const pool = data.pools[0];
      expect(
        (
          await guest.request.get(
            `/api/tournaments/test-cup/mappools/${pool.id}`,
          )
        ).status(),
      ).toBe(404);
      const guestPage = await guest.newPage();
      expect(
        (
          await guestPage.goto(`/tournaments/test-cup/mappools/${pool.id}`)
        )?.status(),
      ).toBe(404);
      const previewUrl = `${url}/preview`;
      expect(
        (
          await guest.request.post(previewUrl, {
            headers,
            data: { beatmap: "123" },
          })
        ).status(),
      ).toBe(401);
      expect(
        (
          await referee.request.post(previewUrl, {
            headers,
            data: { beatmap: "123" },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(previewUrl, {
            headers: { origin: "https://evil.example" },
            data: { beatmap: "123" },
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(previewUrl, {
            headers,
            data: { beatmap: "https://evil.example/123" },
          })
        ).status(),
      ).toBe(400);
      await page.getByRole("button", { name: "FM (0)", exact: true }).click();
      await page.getByText("Add a FM beatmap", { exact: true }).click();
      const input = page.getByRole("textbox", {
        name: "Beatmap URL or ID",
        exact: true,
      });
      await input.fill("https://osu.ppy.sh/beatmapsets/42#osu/123");
      await expect(page.getByRole("status")).toHaveText(
        "Looking up beatmap 123…",
      );
      await expect(
        page.getByRole("button", { name: "Add beatmap", exact: true }),
      ).toBeDisabled();
      const preview = page.getByLabel("Beatmap preview", { exact: true });
      await expect(
        preview.getByRole("link", { name: /Synthetic Browser Song/ }),
      ).toBeVisible();
      await expect(preview).toContainText("4.50 ★ base");
      await expect(preview).toContainText("180 BPM · 2:03");
      await expect(preview).toContainText("Official osu! API");
      await expect(preview).toContainText("Set 42");
      const fetchedAt = await preview.locator("time").getAttribute("datetime");
      await expect(
        page.getByRole("textbox", {
          name: /reason|song title|artist|BPM|duration/i,
        }),
      ).toHaveCount(0);
      await page
        .getByRole("button", { name: "Add beatmap", exact: true })
        .click();
      await expect(page.getByText("Draft · v2", { exact: true })).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);
      const [entry] = await db()
        .select()
        .from(mappoolEntries)
        .where(eq(mappoolEntries.poolId, pool.id));
      expect(entry.metadataFetchedAt.toISOString()).toBe(fetchedAt);
      expect(entry.metadata.title).toBe("Synthetic Browser Song");
      const events = await db()
        .select()
        .from(mappoolEvents)
        .where(eq(mappoolEvents.poolId, pool.id));
      expect(events.find((e) => e.action === "entry_save")).toMatchObject({
        actorId: id,
        reason: null,
        after: { entries: [{ beatmapId: 123, metadata: entry.metadata }] },
      });
      await page.getByRole("button", { name: "FM (1)", exact: true }).click();
      await expect(
        page.getByRole("heading", { name: /Synthetic Browser Song/ }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Publish pool", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByText("Published · v3", { exact: true }),
      ).toBeVisible();
      expect(
        (
          await context.request.post(url, {
            headers,
            data: {
              action: "entry_remove",
              poolId: pool.id,
              expectedVersion: 3,
              entryId: entry.id,

              confirmed: true,
            },
          })
        ).status(),
      ).toBe(409);
      const published = await guest.request.get(
        `/api/tournaments/test-cup/mappools/${pool.id}`,
      );
      expect(published.status()).toBe(200);
      const publicData = await published.json();
      expect(publicData.entries[0].metadata.title).toBe(
        "Synthetic Browser Song",
      );
      expect(JSON.stringify(publicData)).not.toMatch(
        /actorId|reason|before|lockedAt/,
      );
      await guestPage.goto(`/tournaments/test-cup/mappools/${pool.id}`);
      await expect(
        guestPage.getByText(/Force Mod: Synthetic test restrictions/),
      ).toBeVisible();
      await expect(
        guestPage.getByRole("link", { name: /Synthetic Browser Song/ }),
      ).toHaveAttribute("href", "https://osu.ppy.sh/beatmaps/123");
      expect(
        (
          await new AxeBuilder({ page: guestPage })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
            .analyze()
        ).violations,
      ).toEqual([]);
      for (const screen of [page, guestPage])
        expect(
          await screen.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
      await guestPage.evaluate(() => window.scrollTo(0, 0));
      await guestPage.screenshot({
        path: info.outputPath("public-mappool.png"),
        fullPage: true,
        animations: "disabled",
      });
      await page
        .getByRole("button", { name: "Unpublish pool", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(page.getByText("Draft · v4", { exact: true })).toBeVisible();
      expect(
        (
          await guest.request.get(
            `/api/tournaments/test-cup/mappools/${pool.id}`,
          )
        ).status(),
      ).toBe(404);
      expect(
        await (
          await guest.request.get("/api/tournaments/test-cup/mappools")
        ).json(),
      ).toEqual([]);
      await db()
        .update(staffRoles)
        .set({ revokedAt: new Date() })
        .where(eq(staffRoles.userId, id));
      expect((await context.request.get(url)).status()).toBe(403);
    } finally {
      await guest.close();
      await referee.close();
      await db().update(mappools).set({ publishedAt: null });
    }
  });
});
