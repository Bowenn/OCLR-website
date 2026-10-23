import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
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
    await page
      .getByLabel("Archive JSON file", { exact: true })
      .setInputFiles({
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
    await page.goto(`/tournaments/${slug}/results`);
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
    await page.goto(`/tournaments/${slug}/mappools/final`);
    await expect(
      page.getByText("Beatmap ID unresolved", { exact: true }),
    ).toBeVisible();
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
});
