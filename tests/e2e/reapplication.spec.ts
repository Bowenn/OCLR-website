import { test, expect } from "@playwright/test";
import { sql, eq } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { registrations } from "../../src/db/schema";
import { seedSession } from "./session";
import { seedBrowserEditions } from "./setup";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { applicationQuestions } from "../fixtures/application-questions";
import { assertTestDatabase } from "../database";
import { englishStorage } from "../fixtures/preferences";
const api = "/api/tournaments/test-cup/registrations";
test.describe("withdrawn registration reapplication", () => {
  test.beforeEach(async () => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
  });
  test.afterEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);
  for (const source of ["player", "staff"] as const)
    test(`fresh player attempt after ${source === "player" ? "self withdrawal" : "staff-assisted removal"}`, async ({
      page,
      context,
      browser,
      isMobile,
    }, info) => {
      test.setTimeout(90000);
      const adminCookie = await seedSession(isMobile ? 70001 : 60001);
      const userId = isMobile ? 116011 : 116010;
      await context.addCookies([await seedSession(userId)]);
      await context.setExtraHTTPHeaders({ Origin: "http://127.0.0.1:3100" });
      await seedEditions([
        {
          ...edition,
          registration: {
            ...edition.registration,
            questions: applicationQuestions,
          },
        },
      ]);
      const admin = await browser.newContext({
        baseURL: "http://127.0.0.1:3100",
        storageState: englishStorage,
        extraHTTPHeaders: { Origin: "http://127.0.0.1:3100" },
      });
      await admin.addCookies([adminCookie]);
      try {
        if (source === "player") {
          expect(
            (
              await context.request.post(api, {
                data: {
                  configurationVersion: 0,
                  rulesAcknowledged: true,
                  eligibilityAcknowledged: true,
                  rulesVersion: "test-v1",
                  answers: { availability: "weekend" },
                },
              })
            ).status(),
          ).toBe(201);
          await page.goto("/dashboard");
          await page
            .getByRole("button", { name: "Withdraw application", exact: true })
            .click();
          await page
            .getByRole("button", { name: "Confirm", exact: true })
            .click();
          await expect(page.locator(".registration-card .badge")).toHaveText(
            "withdrawn",
          );
        } else {
          const [row] = await db()
            .insert(registrations)
            .values({
              userId,
              editionSlug: edition.slug,
              configurationVersion: 0,
              source: "staff",
              status: "accepted",
              answers: {},
            })
            .returning();
          expect(
            (
              await admin.request.post(
                `/api/admin/tournaments/test-cup/registrations/${row.id}/remove`,
                {
                  data: {
                    confirmed: true,
                    expectedUpdatedAt: row.updatedAt.toISOString(),
                  },
                },
              )
            ).status(),
          ).toBe(200);
          await page.goto("/dashboard");
        }
        await page
          .getByRole("link", { name: "Apply again", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Apply again", exact: true }),
        ).toBeVisible();
        if (source === "player")
          for (const locale of ["en", "zh-Hans", "zh-Hant"])
            for (const theme of ["light", "dark"]) {
              await context.addCookies(
                [
                  ["oclr-locale", locale],
                  ["oclr-theme", theme],
                ].map(([name, value]) => ({
                  name,
                  value,
                  domain: "127.0.0.1",
                  path: "/",
                })),
              );
              await page.reload();
              await page.screenshot({
                path: info.outputPath(`reapply-${locale}-${theme}.png`),
                fullPage: true,
              });
            }
        await context.addCookies([
          { name: "oclr-locale", value: "en", domain: "127.0.0.1", path: "/" },
        ]);
        await page.reload();
        await page
          .getByRole("radio", { name: "Synthetic evening", exact: true })
          .check();
        await page
          .getByLabel("Synthetic introduction (optional)", { exact: true })
          .fill("Fresh personal answer");
        for (const checkbox of await page.getByRole("checkbox").all())
          await checkbox.check();
        await page
          .getByRole("button", {
            name: "Submit individual application",
            exact: true,
          })
          .click();
        await expect(page).toHaveURL(/\/dashboard\?submitted=1$/);
        await expect(page.locator(".registration-card .badge")).toHaveText(
          "pending",
        );
        const [row] = await db()
          .select()
          .from(registrations)
          .where(eq(registrations.userId, userId));
        expect(row).toMatchObject({
          attempt: 2,
          source: "player",
          rulesVersion: "test-v1",
          eligibilityAcknowledged: true,
          status: "pending",
          answers: {
            introduction: "Fresh personal answer",
            availability: "evening",
            preference: "",
          },
        });
        const staffPage = await admin.newPage();
        await staffPage.goto(
          `/admin/tournaments/test-cup/registrations/${row.id}`,
        );
        await staffPage
          .getByText("Previous applications", { exact: true })
          .click();
        await expect(staffPage.locator(".application-history")).toContainText(
          source === "staff"
            ? "Staff-assisted entry"
            : 'Synthetic weekend, "original"',
        );
        const guests = await browser.newContext({
          baseURL: "http://127.0.0.1:3100",
        });
        try {
          expect(
            await (
              await guests.request.get("/api/players?edition=test-cup")
            ).text(),
          ).not.toContain("Fresh personal answer");
        } finally {
          await guests.close();
        }
      } finally {
        await admin.close();
      }
    });
});
