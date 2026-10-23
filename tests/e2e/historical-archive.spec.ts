import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFileSync } from "node:fs";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { closeDb } from "../../src/db";
import { seedSession } from "./session";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { historicalArchive } from "../fixtures/historical-archive";
import { captureResponsiveLayout } from "./responsive";

test.describe("historical archive browser workflow", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.setTimeout(120000);
  test.afterAll(async () => closeDb());
  test("reviews private import, explicitly publishes, and keeps every detail in its edition", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const slug = `history-${isMobile ? "mobile" : "desktop"}-test-${Date.now()}`;
    const archive = { ...historicalArchive, editionSlug: slug };
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    await seedEditions([
      {
        ...edition,
        slug,
        name: "Synthetic historical season",
        season: "9",
        published: false,
        status: "completed",
        registration: null,
      },
    ]);
    const endpoint = `/api/admin/tournaments/${slug}`;
    await page.goto(`/admin/tournaments/${slug}/archive`);
    await page.getByLabel("Archive JSON file", { exact: true }).setInputFiles({
      name: "synthetic-archive.json",
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
    const saved = await (await context.request.get(endpoint)).json();
    expect(saved.edition.published).toBe(false);
    expect(saved.edition.archive).toEqual(archive);
    await page
      .getByRole("link", { name: "Open saved archive preview" })
      .click();
    await expect(
      page.getByText("Private archive preview", { exact: true }),
    ).toBeVisible();
    await page.getByRole("link", { name: "Teams", exact: true }).last().click();
    await page
      .getByRole("link", { name: "Synthetic Alpha", exact: true })
      .first()
      .click();
    await expect(
      page
        .getByRole("heading", { name: "Synthetic Alpha", exact: true })
        .first(),
    ).toBeVisible();
    await expect(page).toHaveURL(
      new RegExp(`/admin/tournaments/${slug}/archive/preview`),
    );
    await page.goto(
      `/admin/tournaments/${slug}/archive/preview?section=mappools`,
    );
    await expect(page.locator(".archive-map-list > li")).toHaveCount(2);
    await page
      .getByRole("navigation", { name: "Mappool stages" })
      .getByRole("link")
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/admin/tournaments/${slug}/archive/preview\\?section=mappools&id=final`,
      ),
    );
    await expect(page.locator(".archive-map-list > li")).toHaveCount(2);
    const guest = await context.browser()!.newContext();
    expect(
      (
        await guest.request.get(`http://127.0.0.1:3100/tournaments/${slug}`)
      ).status(),
    ).toBe(404);
    expect(
      (
        await guest.request.get(
          `http://127.0.0.1:3100/api/admin/tournaments/${slug}`,
        )
      ).ok(),
    ).toBe(false);
    await guest.close();
    const denied = await context.request.post(endpoint, {
      data: {
        action: "publication",
        expectedRevision: 1,
        confirmed: true,
        published: true,
      },
      headers: { Origin: "https://wrong.example" },
    });
    expect(denied.status()).toBe(403);
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
    await page.goto("/tournaments");
    await expect(
      page.getByRole("heading", { name: "Historical seasons" }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Current tournaments" }),
    ).toBeVisible();
    for (const appearance of ["default", "cute-pastel", "swiss-minimal"]) {
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
        await page.goto(`/tournaments/${slug}`);
        await expect(
          page.getByRole("heading", {
            name: "Synthetic historical season",
            exact: true,
          }),
        ).toBeVisible();
        expect((await new AxeBuilder({ page }).analyze()).violations).toEqual(
          [],
        );
      }
    }
    await captureResponsiveLayout(page, info, "archive-overview");
    await page.goto(`/tournaments/${slug}/teams/alpha`);
    await page
      .getByRole("link", { name: "Historical Player", exact: true })
      .click();
    await expect(page).toHaveURL(
      new RegExp(`/tournaments/${slug}/players/91003$`),
    );
    await expect(page.getByText("Tier 1", { exact: true })).toBeVisible();
    await page.goto(`/tournaments/${slug}/players`);
    await expect(
      page.locator('.archive-player-card[data-role="coach"]'),
    ).toContainText("Coach");
    await expect(
      page.locator(".archive-player-card img").first(),
    ).toHaveAttribute("src", /a\.ppy\.sh\/91001/);
    await captureResponsiveLayout(page, info, "archive-players");
    await page.goto(`/tournaments/${slug}/results`);
    await expect(page).toHaveURL(new RegExp(`/schedule\\?status=recorded$`));
    await expect(
      page.getByText("Unconfirmed alternative", { exact: true }),
    ).toHaveCount(0);
    await page
      .getByRole("link", { name: "Historical Final", exact: true })
      .click();
    await expect(page.getByRole("link", { name: "MP 1" })).toHaveAttribute(
      "href",
      "https://osu.ppy.sh/community/matches/123456",
    );
    await page.goto(`/tournaments/${slug}/schedule`);
    await expect(
      page.getByText(
        "Schedule record only; completion and result are not confirmed.",
      ),
    ).toBeVisible();
    await page.getByRole("button", { name: /Unconfirmed records/ }).click();
    await expect(page.locator(".archive-match")).toHaveCount(1);
    await expect(
      page.getByText("Unconfirmed alternative", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: /All matches/ }).click();
    await page.getByLabel("Stage", { exact: true }).selectOption("Final");
    await expect(page.locator(".archive-match")).toHaveCount(2);
    await captureResponsiveLayout(page, info, "archive-matches");
    await page.goto(`/tournaments/${slug}/draft`);
    await expect(
      page.getByRole("heading", { name: "Round 1", exact: true }),
    ).toBeVisible();
    await expect(page.locator(".archive-draft-picks li")).toHaveCount(1);
    await captureResponsiveLayout(page, info, "archive-draft");
    await page.goto(`/tournaments/${slug}/bracket`);
    await expect(page.locator(".bracket-round")).toHaveCount(1);
    await expect(
      page.locator('.bracket-frame [data-match-id="one"]'),
    ).toBeVisible();
    await expect(
      page.locator('.bracket-frame [data-match-id="alternative"]'),
    ).toHaveCount(0);
    await captureResponsiveLayout(page, info, "archive-bracket");
    await page.goto(`/tournaments/${slug}/mappools/final`);
    await expect(
      page.getByText("Beatmap ID unresolved", { exact: false }),
    ).toBeVisible();
    await expect(page.locator(".archive-map-stats").first()).toContainText(
      "2:03",
    );
    await page.getByRole("tab", { name: "TB", exact: true }).click();
    await expect(page.locator(".archive-map-list > li")).toHaveCount(1);
    await expect(
      page
        .locator(".archive-map-stats")
        .getByLabel("Not recorded", { exact: true }),
    ).toHaveCount(6);
    await page.getByRole("tab", { name: "All mods", exact: true }).click();
    await captureResponsiveLayout(page, info, "archive-pool");
    for (const path of ["bracket", "draft", "rules", "results/awards"]) {
      expect((await page.goto(`/tournaments/${slug}/${path}`))?.status()).toBe(
        200,
      );
    }
    for (const path of [
      "teams/missing",
      "players/9999",
      "mappools/missing",
      "matches/missing",
    ]) {
      expect((await page.goto(`/tournaments/${slug}/${path}`))?.status()).toBe(
        404,
      );
    }
    for (const locale of ["zh-Hans", "zh-Hant"]) {
      await context.addCookies([
        { name: "oclr-locale", value: locale, domain: "127.0.0.1", path: "/" },
      ]);
      await page.goto(`/tournaments/${slug}/players`);
      await expect(
        page.getByText(locale === "zh-Hant" ? "歷史歸檔" : "历史归档", {
          exact: true,
        }),
      ).toBeVisible();
      await expect(page.getByText("Captain", { exact: true })).toHaveCount(2);
    }
  });
  test("renders the complete S9 archive across appearances without inventing results", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const slug = `s9-design-${isMobile ? "mobile" : "desktop"}-${Date.now()}`;
    const archive = historicalArchiveSchema.parse({
      ...JSON.parse(readFileSync("docs/imports/s9-archive.json", "utf8")),
      editionSlug: slug,
    });
    await seedEditions([
      {
        ...edition,
        slug,
        name: "S9 archive design verification",
        season: "9",
        published: true,
        status: "completed",
        registration: null,
        archive,
      },
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
        for (const path of [
          "schedule",
          "players",
          "draft",
          "bracket",
          "mappools",
        ]) {
          await page.goto(`/tournaments/${slug}/${path}`);
          if (path === "schedule") {
            await expect(page.locator(".archive-match")).toHaveCount(28);
            await page
              .getByRole("button", { name: /Recorded results/ })
              .click();
            await expect(page.locator(".archive-match")).toHaveCount(22);
          } else if (path === "players") {
            await expect(page.locator(".archive-player-card")).toHaveCount(76);
            await expect(page.locator('[data-role="coach"]')).toHaveCount(8);
          } else if (path === "draft") {
            await expect(page.locator(".archive-draft-round")).toHaveCount(7);
            await expect(page.locator(".archive-draft-picks li")).toHaveCount(
              56,
            );
          } else if (path === "mappools") {
            await expect(page.locator(".archive-map-list > li")).toHaveCount(
              19,
            );
            await expect(
              page
                .getByRole("navigation", { name: "Mappool stages" })
                .getByRole("link"),
            ).toHaveCount(4);
            await expect(
              page.locator(".archive-pool-source"),
            ).not.toHaveAttribute("open", "");
          } else {
            await expect(page.locator(".bracket-round")).toHaveCount(5);
            await expect(
              page.locator(".bracket-frame .match-card"),
            ).toHaveCount(10);
            await expect
              .poll(() => page.locator(".bracket-connectors path").count())
              .toBeGreaterThan(0);
          }
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
    await page.goto(`/tournaments/${slug}/mappools`);
    const stageNav = page.getByRole("navigation", { name: "Mappool stages" });
    for (const pool of archive.pools) {
      await stageNav
        .getByRole("link", {
          name: `${pool.name} ${pool.maps.length}`,
          exact: true,
        })
        .click();
      await expect(page).toHaveURL(new RegExp(`/mappools/${pool.id}$`));
      await expect(page.locator(".archive-map-list > li")).toHaveCount(19);
      await expect(stageNav.locator('[aria-current="page"]')).toContainText(
        pool.name,
      );
      await expect
        .poll(() =>
          stageNav.locator('[aria-current="page"]').evaluate((el) => {
            const a = el.getBoundingClientRect(),
              b = el.parentElement!.getBoundingClientRect();
            return a.left >= b.left - 1 && a.right <= b.right + 1;
          }),
        )
        .toBe(true);
      await page.getByRole("tab", { name: "TB", exact: true }).click();
      const tb = pool.maps.find((m) => m.slot === "TB1")!;
      await expect(page.locator(".archive-map-list > li")).toHaveCount(1);
      await expect(page.locator(".archive-map-identity a")).toHaveAttribute(
        "href",
        `https://osu.ppy.sh/beatmaps/${tb.beatmapId}`,
      );
      await page.getByRole("tab", { name: "TB", exact: true }).press("Home");
      await expect(
        page.getByRole("tab", { name: "All mods", exact: true }),
      ).toBeFocused();
      await expect(page.locator(".archive-map-list > li")).toHaveCount(19);
      await page
        .getByRole("tab", { name: "All mods", exact: true })
        .press("ArrowRight");
      await expect(
        page.getByRole("tab", { name: "NM", exact: true }),
      ).toHaveAttribute("aria-selected", "true");
      const first = pool.maps[0];
      await page
        .getByRole("searchbox", { name: "Search maps", exact: true })
        .fill(String(first.beatmapId));
      await expect(page.locator(".archive-map-list > li")).toHaveCount(1);
      await expect(page.locator(".archive-map-identity h3")).toHaveText(
        first.title,
      );
      await expect(
        page.locator(".archive-map-stats dd").first(),
      ).toHaveAttribute("title", String(first.stars));
      await page
        .getByRole("searchbox", { name: "Search maps", exact: true })
        .fill("nonexistent synthetic song");
      await expect(
        page.getByText("No maps match these filters.", { exact: true }),
      ).toBeVisible();
      await page
        .getByRole("searchbox", { name: "Search maps", exact: true })
        .fill("");
      await page.getByRole("tab", { name: "All mods", exact: true }).click();
      await page.getByText("Source", { exact: true }).click();
      await expect(page.locator(".archive-pool-source")).toContainText(
        pool.source,
      );
    }
    await page.goBack();
    await expect(stageNav.locator('[aria-current="page"]')).toContainText(
      "FINALS",
    );
    await page.goForward();
    await expect(stageNav.locator('[aria-current="page"]')).toContainText(
      "GRAND FINALS",
    );
    for (const [locale, searchLabel] of [
      ["zh-Hans", "搜索谱面"],
      ["zh-Hant", "搜尋譜面"],
    ]) {
      await context.addCookies([
        { name: "oclr-locale", value: locale, domain: "127.0.0.1", path: "/" },
      ]);
      await page.reload();
      await expect(
        page.getByRole("searchbox", { name: searchLabel, exact: true }),
      ).toBeVisible();
      await expect(page.locator(".archive-map-list > li")).toHaveCount(19);
      await expect(page.locator(".archive-map-identity h3").first()).toHaveText(
        archive.pools[3].maps[0].title,
      );
    }
  });
});
