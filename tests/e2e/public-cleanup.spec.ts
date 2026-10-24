import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { editionState } from "../../src/db/schema";
import { edition } from "../fixtures/edition";
import { seedEditions } from "../fixtures/editions";
import { assertTestDatabase } from "../database";
import { captureResponsiveLayout } from "./responsive";

test.describe("concise public tournament surfaces", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([edition]);
  });
  test("keeps empty directory and footer compact while privacy remains discoverable", async ({
    page,
    context,
  }, info) => {
    await page.goto("/players");
    await expect(page).toHaveURL(/\/tournaments$/);
    await page.goto("/players?edition=test-cup");
    await expect(page).toHaveURL(/\/tournaments\/test-cup\/players$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Players");
    await expect(page.getByRole("status")).toHaveText(
      "No accepted players yet",
    );
    await expect(page.locator(".empty-state, .empty-mark")).toHaveCount(0);
    await expect(
      page.getByText(
        /matching public player|Applications stay private|Browse the directory/,
      ),
    ).toHaveCount(0);
    await captureResponsiveLayout(page, info, "compact-empty-players");
    await page
      .getByLabel("Search players", { exact: true })
      .fill("not-a-published-player");
    await page.getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("status")).toHaveText(
      "No matching playersClear filters",
    );
    await page
      .getByRole("link", { name: "Clear filters", exact: true })
      .click();
    await expect(page.getByRole("status")).toHaveText(
      "No accepted players yet",
    );
    await expect(page.locator("footer")).not.toContainText("Emik");
    const credit = page
      .locator("footer")
      .getByRole("link", { name: "Lapis", exact: true });
    await expect(credit).toHaveAttribute(
      "href",
      "https://osu.ppy.sh/users/1176704",
    );
    await expect(credit).toHaveAttribute("rel", "noopener noreferrer");
    await expect(credit).toHaveAttribute("target", "_blank");
    const github = page
      .locator("footer")
      .getByRole("link", { name: "GitHub", exact: true });
    await expect(github).toHaveAttribute(
      "href",
      "https://github.com/PhoenixEmik/OCLR-website",
    );
    await expect(github).toHaveAttribute("rel", "noopener noreferrer");
    await expect(github).toHaveAttribute("target", "_blank");
    await expect(page.locator("footer a")).toHaveCount(2);
    await expect(page.locator("footer button, footer nav")).toHaveCount(0);
    await page.goto("/about");
    await page
      .getByRole("link", { name: "privacy notice", exact: true })
      .click();
    await expect(page).toHaveURL(/\/privacy$/);
    await page.goto("/login");
    await expect(
      page.getByRole("link", { name: "privacy notice", exact: true }),
    ).toHaveAttribute("href", "/privacy");
    expect(
      (await context.cookies()).filter((c) => c.name !== "oclr-locale"),
    ).toEqual([]);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
  test("renders one featured identity, honest entry actions and only meaningful summaries without changing stored content", async ({
    page,
  }, info) => {
    const bootstrap =
      "osu! Chinese League Rookie — Season 11. Tournament information is awaiting organizer approval.";
    const featured = {
      ...edition,
      name: "OCLR Season 11",
      season: "11",
      status: "live" as const,
      summary: bootstrap,
      branding: {
        logo: "/oclr-s11-square-logo.webp" as const,
        background: "/oclr-s11-website-background.webp" as const,
        keyVisual: "/oclr-s11-key-visual.webp" as const,
      },
    };
    await seedEditions([
      featured,
      {
        ...edition,
        slug: "other-public-edition",
        name: "Another approved edition",
        status: "upcoming",
        summary: "An approved custom description.",
      },
    ]);
    const cases = [
      {
        name: "open",
        registration: edition.registration,
        status: "live" as const,
        label: null,
      },
      {
        name: "upcoming",
        registration: {
          ...edition.registration!,
          opensAt: "2098-01-01T00:00:00Z",
        },
        status: "live" as const,
        label: "Registration opens",
      },
      {
        name: "paused",
        registration: { ...edition.registration!, enabled: false },
        status: "live" as const,
        label: "Registration paused",
      },
      {
        name: "closed",
        registration: {
          ...edition.registration!,
          closesAt: "2025-02-01T00:00:00Z",
          withdrawUntil: null,
        },
        status: "live" as const,
        label: "Registration closed",
      },
      {
        name: "completed",
        registration: edition.registration,
        status: "completed" as const,
        label: "Registration closed",
      },
      {
        name: "unannounced",
        registration: null,
        status: "live" as const,
        label: "Registration not announced",
      },
    ];
    // Retain featured selection for completed-state coverage rather than selecting the other upcoming edition.
    for (const item of cases) {
      await db()
        .update(editionState)
        .set({
          configuration: {
            ...featured,
            registration: item.registration,
            status: item.status,
          },
        })
        .where(eq(editionState.slug, featured.slug));
      if (item.name === "completed")
        await db()
          .update(editionState)
          .set({
            configuration: {
              ...edition,
              name: "Another approved edition",
              published: false,
            },
          })
          .where(eq(editionState.slug, "other-public-edition"));
      const [before] = await db()
        .select()
        .from(editionState)
        .where(eq(editionState.slug, featured.slug));
      await page.goto("/");
      await expect(page.locator("#hero-title")).toHaveText(featured.name);
      await expect(page.locator(".hero-kicker")).toHaveText(
        "osu! Chinese League Rookie",
      );
      await expect(page.locator(".hero")).not.toContainText(
        "awaiting organizer approval",
      );
      await expect(page.locator(".hero-tagline, .brand-note")).toHaveCount(0);
      await expect(page.locator(".hero .actions a")).toHaveCount(
        item.name === "open" ? 2 : 1,
      );
      await expect(page.locator(".hero .actions a").first()).toContainText(
        item.name === "open" ? "Register" : "View tournament",
      );
      if (item.label)
        await expect(page.locator(".hero-enrollment")).toContainText(item.label);
      else await expect(page.locator(".hero-enrollment")).toHaveCount(0);
      if (item.name === "open")
        await captureResponsiveLayout(page, info, "compact-s11-home");
      const [after] = await db()
        .select()
        .from(editionState)
        .where(eq(editionState.slug, featured.slug));
      expect(after).toEqual(before);
    }
    await page.goto("/tournaments");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Tournaments",
    );
    await expect(page.locator(".edition-card")).not.toContainText(
      "awaiting organizer approval",
    );
    await captureResponsiveLayout(page, info, "compact-tournaments");
    await db()
      .update(editionState)
      .set({
        configuration: {
          ...featured,
          summary: "Approved event-specific details.",
          registration: edition.registration,
        },
      })
      .where(eq(editionState.slug, featured.slug));
    await page.goto("/");
    await expect(page.locator(".hero-copy")).toHaveText(
      "Approved event-specific details.",
    );
    await page.goto("/tournaments");
    await expect(page.locator(".edition-card")).toContainText(
      "Approved event-specific details.",
    );
    await page.goto("/news");
    await expect(page.locator(".page-heading p")).toHaveCount(0);
    await captureResponsiveLayout(page, info, "compact-news");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
});
