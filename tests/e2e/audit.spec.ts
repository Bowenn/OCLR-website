import { englishStorage } from "../fixtures/preferences";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { editionEvents, staffRoles } from "../../src/db/schema";
import { seedSession } from "./session";
test.describe("central Admin audit browser", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("filters historical changes and denies anonymous, operator and foreign-edition access", async ({
    page,
    context,
    browser,
    isMobile,
  }) => {
    const admin = isMobile ? 70001 : 60001;
    await seedSession(admin);
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await context.addCookies([await seedSession(admin)]);
    await db()
      .insert(editionEvents)
      .values(
        Array.from({ length: 28 }, (_, i) => ({
          editionSlug: "test-cup",
          actorId: admin,
          kind: "tournament_general",
          detail: {
            entity: { type: "tournament", id: "test-cup" },
            before: { name: "Old" },
            after: { name: `New ${i}` },
            answers: { private: "PRIVATE_REGISTRATION_ANSWER" },
          },
          createdAt: new Date("2026-01-02T12:00:00Z"),
        })),
      );
    await db()
      .insert(editionEvents)
      .values({
        editionSlug: "test-cup",
        actorId: admin,
        kind: "captain_appoint",
        detail: {
          entity: { type: "captain_setup", id: "test-cup" },
          before: [],
          after: [{ userId: admin }],
        },
        createdAt: new Date("2026-01-03T12:00:00Z"),
      });
    await page.goto("/admin/audit");
    await expect(
      page.getByRole("heading", { name: "Audit log", exact: true }),
    ).toBeVisible();
    const events = page
      .getByRole("list", { name: "Audit events", exact: true })
      .getByRole("listitem");
    const tabs = page.getByRole("tablist", {
      name: "Audit modules",
      exact: true,
    });
    await expect(events).toHaveCount(25);
    await expect(
      tabs.getByRole("tab", { name: "All activity", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(page.locator(".audit-event[open]")).toHaveCount(0);
    await expect(
      page.getByLabel("Actor osu! ID", { exact: true }),
    ).not.toBeVisible();
    const row = await events.first().boundingBox();
    expect(row!.height).toBeLessThan(160);
    await tabs.getByRole("tab", { name: "Tournament", exact: true }).click();
    await expect(
      page.getByText("28 events · Page 1", { exact: true }),
    ).toBeVisible();
    await expect(
      tabs.getByRole("tab", { name: "Tournament", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await page.getByText("More filters", { exact: true }).click();
    await page
      .getByRole("combobox", { name: "Tournament", exact: true })
      .selectOption("test-cup");
    await page.getByLabel("Actor osu! ID", { exact: true }).fill(String(admin));
    await page
      .getByLabel("Action type", { exact: true })
      .fill("tournament_general");
    await page.getByLabel("From (UTC)").fill("2026-01-02");
    await page.getByLabel("Through (UTC)").fill("2026-01-02");
    await page.getByRole("button", { name: "Filter", exact: true }).click();
    await expect(
      page.getByText("28 events · Page 1", { exact: true }),
    ).toBeVisible();
    await events.first().locator("summary").first().focus();
    await events.first().locator("summary").first().press("Enter");
    await expect(
      events
        .first()
        .getByRole("heading", { name: "1 changed field", exact: true }),
    ).toBeVisible();
    await expect(events.first().locator(".detail-list")).toContainText(
      "Old → New",
    );
    await expect(events.first().locator(".audit-json")).not.toBeVisible();
    await events
      .first()
      .getByText("Raw details (redacted)", { exact: true })
      .click();
    await expect(events.first().locator(".audit-json")).toBeVisible();
    await events.first().locator("summary").first().press("Enter");
    await expect(page.locator(".audit-event[open]")).toHaveCount(0);
    await page.getByRole("link", { name: "Next →", exact: true }).click();
    await expect(events).toHaveCount(3);
    await expect(page).toHaveURL(/module=tournament.*page=2/);
    await page.getByText("More filters", { exact: true }).click();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({
      path: test.info().outputPath("audit-log.png"),
      fullPage: true,
    });
    await tabs.getByRole("tab", { name: "Captains", exact: true }).click();
    await expect(
      page.getByText("No matching audit events.", { exact: true }),
    ).toBeVisible();
    const scopedUrl = new URL(page.url());
    expect(scopedUrl.searchParams.get("page")).toBeNull();
    expect(scopedUrl.searchParams.get("actor")).toBe(String(admin));
    expect(scopedUrl.searchParams.get("edition")).toBe("test-cup");
    expect(scopedUrl.searchParams.get("from")).toBe("2026-01-02");
    await page
      .getByRole("link", { name: "Reset filters", exact: true })
      .click();
    await expect(events).toHaveCount(1);
    await expect(events.first()).toContainText("captain appoint");
    await expect(
      page.getByRole("combobox", { name: "Tournament", exact: true }),
    ).toHaveValue("");
    await page.reload();
    await expect(
      tabs.getByRole("tab", { name: "Captains", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await tabs.getByRole("tab", { name: "Captains", exact: true }).focus();
    await tabs
      .getByRole("tab", { name: "Captains", exact: true })
      .press("Home");
    await expect(
      tabs.getByRole("tab", { name: "All activity", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(
      page.getByText("29 events · Page 1", { exact: true }),
    ).toBeVisible();
    expect(await page.content()).not.toContain("PRIVATE_REGISTRATION_ANSWER");
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
    await page.goto("/admin/audit?from=2026-02-01&to=2026-01-01");
    await expect(
      page.getByRole("alert").filter({ hasText: "Check the audit filters" }),
    ).toContainText("Check the audit filters");
    await page
      .getByRole("link", { name: "Reset audit filters", exact: true })
      .click();
    await expect(
      page.getByRole("heading", { name: "Audit log", exact: true }),
    ).toBeVisible();
    const guest = await browser.newContext({
      storageState: englishStorage,
      baseURL: "http://127.0.0.1:3100",
    });
    try {
      expect((await guest.request.get("/api/admin/audit")).status()).toBe(401);
      for (const [id, role] of [
        [admin + 400, "mappooler"],
        [admin + 401, "referee"],
        [admin + 402, "admin"],
      ] as const) {
        await guest.addCookies([await seedSession(id)]);
        await db().insert(staffRoles).values({
          userId: id,
          role,
          editionSlug: "test-cup",
          grantedBy: admin,
        });
        expect(
          (await guest.request.get("/api/admin/audit?edition=s11")).status(),
        ).toBe(403);
        if (role !== "admin") {
          expect(
            (
              await guest.request.get("/api/admin/audit?edition=test-cup")
            ).status(),
          ).toBe(403);
          const operator = await guest.newPage();
          await operator.goto("/admin/audit");
          await expect(
            operator.getByRole("heading", {
              name: "Off the beat.",
              exact: true,
            }),
          ).toBeVisible();
          await operator.close();
        } else {
          const response = await guest.request.get("/api/admin/audit");
          expect(response.status()).toBe(200);
          expect(
            (await response.json()).rows.every(
              (e: { edition: string }) => e.edition === "test-cup",
            ),
          ).toBe(true);
        }
      }
    } finally {
      await guest.close();
    }
  });
});
