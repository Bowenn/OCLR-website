import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { registrations } from "../../src/db/schema";
import { assertTestDatabase } from "../database";
import { seedSession } from "./session";
import { seedBrowserEditions } from "./setup";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { applicationQuestions } from "../fixtures/application-questions";
import { englishStorage } from "../fixtures/preferences";
const endpoint = "/api/admin/tournaments/test-cup";
const registrationEndpoint = "/api/tournaments/test-cup/registrations";
let playerCookie: Awaited<ReturnType<typeof seedSession>>;
async function configureQuestions(required = true) {
  await seedEditions([
    {
      ...edition,
      rules: null,
      eligibility: null,
      registration: {
        ...edition.registration,
        questions: applicationQuestions.map((q) =>
          q.id === "availability" ? { ...q, required } : q,
        ),
      },
    },
  ]);
}
test.describe("versioned registration question builder and answers", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.beforeEach(async ({ context, isMobile }) => {
    assertTestDatabase(process.env.TEST_DATABASE_URL);
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    const adminCookie = await seedSession(isMobile ? 70001 : 60001);
    playerCookie = await seedSession(isMobile ? 114011 : 114010);
    await context.addCookies([adminCookie]);
    await context.setExtraHTTPHeaders({ Origin: "http://127.0.0.1:3100" });
    await seedEditions([{ ...edition, rules: null, eligibility: null }]);
  });
  test.afterEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedBrowserEditions();
  });
  test.afterAll(closeDb);
  test("creates, reorders and persists text and stable single-choice options", async ({
    page,
  }, info) => {
    await page.goto(
      "/admin/tournaments/test-cup/settings?section=registration",
    );
    const questions = page.locator(".application-question");
    const baseline = await (await page.request.get(endpoint)).json();
    const invalid = await page.request.post(endpoint, {
      data: {
        action: "registration",
        confirmed: true,
        expectedRevision: baseline.revision,
        registration: {
          ...baseline.edition.registration,
          questions: [{ ...applicationQuestions[1], type: "multiple_choice" }],
        },
      },
    });
    expect(invalid.status()).toBe(400);
    expect((await (await page.request.get(endpoint)).json()).revision).toBe(
      baseline.revision,
    );
    await page
      .getByRole("button", { name: "Add question", exact: true })
      .click();
    await questions
      .nth(0)
      .getByRole("textbox", { name: "Question 1 label", exact: true })
      .fill("Synthetic introduction");
    await expect(
      questions
        .nth(0)
        .getByRole("combobox", { name: "Question type", exact: true }),
    ).toHaveValue("text");
    await questions.nth(0).getByRole("spinbutton").fill("24");
    await page
      .getByRole("button", { name: "Add question", exact: true })
      .click();
    const choice = questions.nth(1);
    await choice
      .getByRole("textbox", { name: "Question 2 label", exact: true })
      .fill("Synthetic availability");
    await choice
      .getByRole("combobox", { name: "Question type", exact: true })
      .selectOption("single_choice");
    await expect(choice.getByRole("spinbutton")).toHaveCount(0);
    await expect(
      page.getByRole("button", {
        name: "Save registration settings",
        exact: true,
      }),
    ).toBeDisabled();
    await choice
      .getByRole("textbox", { name: "Option 1", exact: true })
      .fill("Synthetic evening");
    await choice
      .getByRole("textbox", { name: "Option 2", exact: true })
      .fill("Synthetic evening");
    await expect(
      page.getByRole("button", {
        name: "Save registration settings",
        exact: true,
      }),
    ).toBeDisabled();
    await choice
      .getByRole("textbox", { name: "Option 2", exact: true })
      .fill('Synthetic weekend, "original"');
    await choice
      .getByRole("checkbox", { name: "Question 2 is required", exact: true })
      .check();
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith(endpoint) &&
          r.request().method() === "POST" &&
          r.status() === 200,
      ),
      page
        .getByRole("button", {
          name: "Save registration settings",
          exact: true,
        })
        .click(),
    ]);
    await page.reload();
    let saved = await (await page.request.get(endpoint)).json();
    const original = saved.edition.registration.questions;
    expect(original[0]).toMatchObject({
      type: "text",
      maxLength: 24,
      required: false,
    });
    expect(original[1]).toMatchObject({
      type: "single_choice",
      required: true,
    });
    await expect(
      choice.getByRole("combobox", { name: "Question type", exact: true }),
    ).toHaveValue("single_choice");
    await choice
      .getByRole("button", { name: "Add option", exact: true })
      .click();
    await choice
      .getByRole("textbox", { name: "Option 3", exact: true })
      .fill("Synthetic third");
    await choice
      .getByRole("button", { name: "Move option 2 up", exact: true })
      .focus();
    await page.keyboard.press("Enter");
    await expect(
      choice.getByRole("textbox", { name: "Option 1", exact: true }),
    ).toHaveValue('Synthetic weekend, "original"');
    await choice
      .getByRole("button", { name: "Remove option 3", exact: true })
      .click();
    await choice
      .getByRole("textbox", { name: "Option 1", exact: true })
      .fill("Updated display label");
    await choice
      .getByRole("button", { name: "Move question 2 up", exact: true })
      .click();
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().endsWith(endpoint) &&
          r.request().method() === "POST" &&
          r.status() === 200,
      ),
      page
        .getByRole("button", {
          name: "Save registration settings",
          exact: true,
        })
        .click(),
    ]);
    await page.reload();
    saved = await (await page.request.get(endpoint)).json();
    expect(saved.edition.registration.questions[0]).toMatchObject({
      id: original[1].id,
      options: [
        { id: original[1].options[1].id, label: "Updated display label" },
        original[1].options[0],
      ],
    });
    expect(saved.edition.registration.questions[1].id).toBe(original[0].id);
    await questions.nth(0).scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath("saved-question-builder.png"),
      fullPage: true,
    });
    expect(
      (await new AxeBuilder({ page }).include("main").analyze()).violations,
    ).toEqual([]);
  });
  test("validates authoritative choices, retains failed selections and resolves historical private answers in review/dashboard/export", async ({
    page,
    browser,
    isMobile,
  }) => {
    await configureQuestions();
    const player = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
      storageState: englishStorage,
      extraHTTPHeaders: { Origin: "http://127.0.0.1:3100" },
    });
    try {
      await player.addCookies([playerCookie]);
      const form = await player.newPage();
      await form.goto("/tournaments/test-cup/register");
      const submit = form.getByRole("button", {
        name: "Submit individual application",
        exact: true,
      });
      await form
        .getByLabel("Synthetic introduction (optional)", { exact: true })
        .fill("Original private answer");
      await submit.click();
      await expect(form).toHaveURL(/\/register$/);
      expect(
        await form.locator('input[type="radio"]:invalid').count(),
      ).toBeGreaterThan(0);
      const bad = await player.request.post(registrationEndpoint, {
        data: { configurationVersion: 0, answers: { availability: "forged" } },
      });
      expect(bad.status()).toBe(400);
      expect((await bad.json()).field).toBe("availability");
      expect(
        (
          await player.request.post(endpoint, {
            data: {
              action: "publication",
              confirmed: true,
              expectedRevision: 0,
              published: false,
            },
          })
        ).status(),
      ).toBe(403);
      await form
        .getByRole("radio", { name: "Synthetic evening", exact: true })
        .check();
      await form
        .getByRole("radio", {
          name: 'Synthetic weekend, "original"',
          exact: true,
        })
        .check();
      await expect(
        form.getByRole("radio", { name: "Synthetic evening", exact: true }),
      ).not.toBeChecked();
      await form
        .getByRole("combobox", {
          name: "Synthetic optional choice (optional)",
          exact: true,
        })
        .selectOption("option_3");
      await form.route(
        `**${registrationEndpoint}`,
        async (route) => {
          const input = route.request().postDataJSON();
          input.answers.availability = "forged";
          await route.fulfill({
            response: await route.fetch({ postData: JSON.stringify(input) }),
          });
        },
        { times: 1 },
      );
      await submit.click();
      await expect(form.locator(".application-answer [role=alert]")).toHaveText(
        "Choose a valid option for this question.",
      );
      await expect(
        form.getByRole("radio", {
          name: 'Synthetic weekend, "original"',
          exact: true,
        }),
      ).toBeChecked();
      await expect(
        form.getByRole("combobox", {
          name: "Synthetic optional choice (optional)",
          exact: true,
        }),
      ).toHaveValue("option_3");
      await Promise.all([
        form.waitForResponse(
          (r) => r.url().endsWith(registrationEndpoint) && r.status() === 201,
        ),
        submit.click(),
      ]);
      await expect(form).toHaveURL(/\/dashboard\?submitted=1$/);
      const [saved] = await db()
        .select()
        .from(registrations)
        .where(eq(registrations.userId, isMobile ? 114011 : 114010));
      expect(saved.answers).toEqual({
        introduction: "Original private answer",
        availability: "weekend",
        preference: "option_3",
      });
      const { id } = saved;
      let current = await (await page.request.get(endpoint)).json();
      const choice = {
        ...applicationQuestions[1],
        options: [
          { id: "evening", label: "Changed evening" },
          { id: "new_option", label: "Replacement option" },
        ],
      };
      for (const questions of [[choice], []]) {
        const changed = await page.request.post(endpoint, {
          data: {
            action: "registration",
            confirmed: true,
            expectedRevision: current.revision,
            registration: { ...current.edition.registration, questions },
          },
        });
        expect(changed.status()).toBe(200);
        current = await changed.json();
      }
      await form.reload();
      await form.getByText("My application", { exact: true }).click();
      await expect(form.locator(".detail-list")).toContainText(
        'Synthetic weekend, "original"',
      );
      await expect(form.locator(".detail-list")).toContainText(
        "Original private answer",
      );
      await page.goto(`/admin/tournaments/test-cup/registrations/${id}`);
      await expect(
        page.getByText('Synthetic weekend, "original"', { exact: true }),
      ).toBeVisible();
      const download = await page.request.get(
        "/api/admin/registrations/export?edition=test-cup",
      );
      expect(download.status()).toBe(200);
      const exported = await download.text();
      expect(exported).toContain('Synthetic weekend, ""original"" [weekend]');
      expect(exported).not.toContain("Replacement option");
      const guest = await browser.newContext({
        baseURL: "http://127.0.0.1:3100",
      });
      try {
        expect([401, 403]).toContain(
          (
            await guest.request.get(
              "/api/admin/registrations/export?edition=test-cup",
            )
          ).status(),
        );
        const publicData = await guest.request.get(
          "/api/players?edition=test-cup",
        );
        expect(await publicData.text()).not.toMatch(
          /Original private answer|weekend|availability/,
        );
      } finally {
        await guest.close();
      }
    } finally {
      await player.close();
    }
  });
  test("renders compact accessible forms in three locales and both themes at mobile/tablet/desktop widths", async ({
    page,
    context,
    isMobile,
  }, info) => {
    test.setTimeout(120000);
    await configureQuestions(false);
    await context.addCookies([playerCookie]);
    for (const locale of ["en", "zh-Hans", "zh-Hant"])
      for (const theme of ["light", "dark"])
        for (const width of isMobile ? [320, 390] : [768, 1440]) {
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
          await page.setViewportSize({ width, height: 900 });
          await page.goto("/tournaments/test-cup/register");
          const radio = page.getByRole("radio", {
            name: "Synthetic evening",
            exact: true,
          });
          await expect(
            page.locator('input[type="radio"][value=""]'),
          ).toBeChecked();
          await radio.focus();
          await page.keyboard.press("Space");
          await expect(radio).toBeChecked();
          await page.keyboard.press("ArrowDown");
          await expect(
            page.getByRole("radio", {
              name: 'Synthetic weekend, "original"',
              exact: true,
            }),
          ).toBeChecked();
          const box = (await radio.boundingBox())!;
          expect(box.width).toBeLessThanOrEqual(20);
          expect(box.height).toBeLessThanOrEqual(20);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          await page.locator("main").screenshot({
            path: info.outputPath(`applicant-${width}-${locale}-${theme}.png`),
          });
          expect(
            (await new AxeBuilder({ page }).include("main").analyze())
              .violations,
          ).toEqual([]);
          await context.addCookies([
            await seedSession(isMobile ? 70001 : 60001),
          ]);
          await page.goto(
            "/admin/tournaments/test-cup/settings?section=registration",
          );
          await expect(page.locator(".application-question")).toHaveCount(3);
          expect(
            await page.evaluate(() => document.documentElement.scrollWidth),
          ).toBeLessThanOrEqual(width);
          await page.locator("main").screenshot({
            path: info.outputPath(`builder-${width}-${locale}-${theme}.png`),
          });
          expect(
            (await new AxeBuilder({ page }).include("main").analyze())
              .violations,
          ).toEqual([]);
          await context.addCookies([playerCookie]);
        }
  });
});
