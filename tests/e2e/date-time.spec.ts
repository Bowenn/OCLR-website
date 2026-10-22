import { selectTimeZone } from "./time-zone";
import { test, expect, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { db, closeDb } from "../../src/db";
import { eq } from "drizzle-orm";
import { editionState } from "../../src/db/schema";
import { edition } from "../fixtures/edition";
import { seedEditions } from "../fixtures/editions";
import { seedSession } from "./session";
import { mappoolCommand } from "../../src/lib/mappools";
import { captureResponsiveLayout } from "./responsive";

test.describe("compact zoned date and 24-hour time editing", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.setTimeout(120000);
  test.afterAll(async () => closeDb());
  test("preserves exact instants, blocks partial/DST drafts and schedules in the selected zone", async ({
    page,
    context,
    isMobile,
  }, info) => {
    const adminId = isMobile ? 70001 : 60001;
    const slug = `date-time-${isMobile ? "mobile" : "desktop"}`;
    await context.addCookies([await seedSession(adminId)]);
    const original = {
      enabled: false,
      opensAt: "2026-10-11T15:10:42.123+08:00",
      closesAt: "2026-10-31T15:10:23.456+08:00",
      withdrawUntil: "2026-10-30T15:10:17.789+08:00",
      questions: [],
    };
    await db().delete(editionState).where(eq(editionState.slug, slug));
    await seedEditions([
      {
        ...edition,
        slug,
        timeZone: "Asia/Hong_Kong",
        registration: original,
        schedule: [{ label: "Synthetic milestone", at: original.opensAt }],
      },
    ]);
    const headers = { origin: "http://127.0.0.1:3100" };
    const endpoint = `/api/admin/tournaments/${slug}`;
    const current = async () => (await context.request.get(endpoint)).json();
    const date = (label: string, scope: Locator = page.locator("main")) =>
      scope.getByLabel(`${label}: date`, { exact: true });
    const time = (label: string, scope: Locator = page.locator("main")) =>
      scope.getByLabel(`${label}: time (HH:mm)`, { exact: true });
    async function save(name: string) {
      const response = page.waitForResponse(
        (r) => r.request().method() === "POST" && r.url().endsWith(endpoint),
      );
      await page.getByRole("button", { name, exact: true }).click();
      expect((await response).status()).toBe(200);
      await expect(page.getByRole("status")).toContainText("saved");
    }
    async function zone(timeZone: string) {
      const state = await current();
      const { name, season, summary, branding, status } = state.edition;
      expect(
        (
          await context.request.post(endpoint, {
            headers,
            data: {
              action: "general",
              name,
              season,
              summary,
              branding,
              status,
              timeZone,
              expectedRevision: state.revision,
              confirmed: true,
            },
          })
        ).status(),
      ).toBe(200);
    }
    await page.goto(`/admin/tournaments/${slug}/settings?section=registration`);
    await expect(date("Registration opens")).toHaveValue("2026-10-11");
    await expect(time("Registration opens")).toHaveValue("15:10");
    await expect(time("Registration opens")).toHaveAttribute("type", "text");
    await expect(time("Registration opens")).toHaveAttribute(
      "inputmode",
      "numeric",
    );
    await expect(
      page.locator('input[type="datetime-local"], input[type="time"]'),
    ).toHaveCount(0);
    await save("Save registration settings");
    expect((await current()).edition.registration).toEqual(original);
    await time("Registration opens").fill("1");
    await expect(time("Registration opens")).toHaveValue("1");
    await expect(
      page.getByRole("button", {
        name: "Save registration settings",
        exact: true,
      }),
    ).toBeDisabled();
    await expect(
      page.locator(".zoned-date-input").getByRole("alert"),
    ).toContainText("24-hour HH:mm");
    expect((await current()).edition.registration).toEqual(original);
    await time("Registration opens").fill("");
    await expect(date("Registration opens")).toHaveValue("2026-10-11");
    await expect(
      page.locator(".zoned-date-input").getByRole("alert"),
    ).toContainText("both a date and a time");
    await time("Registration opens").pressSequentially("1510");
    await expect(time("Registration opens")).toHaveValue("15:10");
    await date("Registration opens").fill("");
    await expect(time("Registration opens")).toHaveValue("15:10");
    await expect(
      page.getByRole("button", {
        name: "Save registration settings",
        exact: true,
      }),
    ).toBeDisabled();
    await date("Registration opens").fill("2026-10-11");
    await time("Withdrawal deadline").fill("24:00");
    await expect(
      page.getByRole("button", {
        name: "Save registration settings",
        exact: true,
      }),
    ).toBeDisabled();
    await page
      .getByRole("button", {
        name: "Clear Withdrawal deadline",
        exact: true,
      })
      .click();
    await save("Save registration settings");
    expect((await current()).edition.registration).toEqual({
      ...original,
      withdrawUntil: null,
    });
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Add question", exact: true }),
    ).toBeVisible();
    await expect(time("Withdrawal deadline")).toHaveValue("");
    await time("Registration opens").focus();
    await page.keyboard.press("Tab");
    await expect(date("Registration closes")).toBeFocused();
    await expect(page).toHaveTitle(/Tournament settings/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await captureResponsiveLayout(page, info, "compact-registration-time");
    for (const field of await page
      .locator(".zoned-date-fields input:visible")
      .all()) {
      expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    }
    await page.goto(`/admin/tournaments/${slug}/settings?section=schedule`);
    await save("Save milestones");
    expect((await current()).edition.schedule[0].at).toBe(original.opensAt);
    await date("Milestone 1 time").fill("2026-10-12");
    await time("Milestone 1 time").fill("15:10");
    await save("Save milestones");
    expect((await current()).edition.schedule[0].at).toBe(
      "2026-10-12T07:10:00.000Z",
    );
    await zone("America/New_York");
    await page.reload();
    await date("Milestone 1 time").fill("2026-03-08");
    await time("Milestone 1 time").fill("02:30");
    await expect(
      page.locator(".zoned-date-input").getByRole("alert"),
    ).toContainText("does not exist");
    await expect(
      page.getByRole("button", { name: "Save milestones", exact: true }),
    ).toBeDisabled();
    expect((await current()).edition.schedule[0].at).toBe(
      "2026-10-12T07:10:00.000Z",
    );
    await date("Milestone 1 time").fill("2026-11-01");
    await time("Milestone 1 time").fill("01:30");
    await expect(
      page.locator(".zoned-date-input").getByRole("alert"),
    ).toContainText("occurs twice");
    await expect(
      page.getByRole("button", { name: "Save milestones", exact: true }),
    ).toBeDisabled();
    await page
      .getByLabel("Milestone 1 time: clock-change offset", { exact: true })
      .selectOption("2026-11-01T06:30:00.000Z");
    await save("Save milestones");
    expect((await current()).edition.schedule[0].at).toBe(
      "2026-11-01T06:30:00.000Z",
    );
    await page.reload();
    await expect(
      page.getByLabel("Milestone 1 time: clock-change offset", { exact: true }),
    ).toHaveValue("2026-11-01T06:30:00.000Z");
    await save("Save milestones");
    expect((await current()).edition.schedule[0].at).toBe(
      "2026-11-01T06:30:00.000Z",
    );
    await page
      .getByRole("button", {
        name: "Clear Milestone 1 time",
        exact: true,
      })
      .click();
    await save("Save milestones");
    expect((await current()).edition.schedule[0].at).toBeNull();

    await zone("Asia/Hong_Kong");
    process.env.ADMIN_OSU_IDS = String(adminId);
    await mappoolCommand(
      { osuId: adminId, username: "Synthetic Admin" },
      slug,
      {
        action: "round_create",
        stage: "knockout",
        name: "Synthetic round",
        position: 1,
        confirmed: true,
      },
    );
    await page.goto(`/admin/tournaments/${slug}/matches`);
    await page
      .getByRole("button", { name: "Create a fixture", exact: true })
      .click();
    const dialog = page.getByRole("dialog");
    await dialog
      .getByLabel("Fixture label", { exact: true })
      .fill("Synthetic zoned fixture");
    await expect(
      dialog.getByRole("group", { name: "Match options", exact: true }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("button", { name: "Time zone", exact: true }),
    ).toContainText("Asia/Hong_Kong");
    await date("Scheduled date and time", dialog).fill("2026-10-11");
    await expect(
      dialog.getByRole("button", { name: "Create fixture", exact: true }),
    ).toBeDisabled();
    await time("Scheduled date and time", dialog).fill("15:10");
    await selectTimeZone(dialog, "UTC");
    await expect(time("Scheduled date and time", dialog)).toHaveValue("07:10");
    await selectTimeZone(dialog, "Asia/Hong_Kong");
    await expect(time("Scheduled date and time", dialog)).toHaveValue("15:10");
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.setViewportSize({ width: isMobile ? 320 : 1280, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: info.outputPath("compact-fixture-time.png"),
    });
    await dialog
      .getByRole("button", { name: "Create fixture", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const matches = await (
      await context.request.get(`${endpoint}/matches`)
    ).json();
    expect(matches.fixtures[0].scheduledAt).toBe("2026-10-11T07:10:00.000Z");
    expect(matches.fixtures[0].timeZone).toBe("Asia/Hong_Kong");
    const f = matches.fixtures[0];
    const precise = "2026-10-11T07:10:42.123Z";
    const fields = Object.fromEntries(
      [
        "label",
        "roundId",
        "homeTeamId",
        "awayTeamId",
        "mappoolId",
        "position",
        "timeZone",
        "status",
        "homeSourceId",
        "homeSourceOutcome",
        "awaySourceId",
        "awaySourceOutcome",
      ].map((key) => [key, f[key]]),
    );
    expect(
      (
        await context.request.post(`${endpoint}/matches`, {
          headers,
          data: {
            ...fields,
            action: "edit",
            fixtureId: f.id,
            expectedVersion: f.version,
            scheduledAt: precise,
            confirmed: true,
          },
        })
      ).status(),
    ).toBe(200);
    await page.reload();
    await page
      .getByRole("button", { name: "Manage fixture", exact: true })
      .click();
    await expect(time("Scheduled date and time", dialog)).toHaveValue("15:10");
    await expect(
      dialog.getByRole("group", { name: "Match options", exact: true }),
    ).toBeVisible();
    await selectTimeZone(dialog, "UTC");
    await expect(time("Scheduled date and time", dialog)).toHaveValue("07:10");
    await dialog
      .getByRole("button", { name: "Save fixture amendment", exact: true })
      .click();
    await expect(dialog).not.toBeVisible();
    const amended = await (
      await context.request.get(`${endpoint}/matches`)
    ).json();
    expect(amended.fixtures[0].scheduledAt).toBe(precise);
    expect(amended.fixtures[0].timeZone).toBe("UTC");
  });
  test("keeps compact zone suffixes authoritative after saved General settings", async ({
    page,
    context,
    isMobile,
  }) => {
    const slug = `compact-zone-${isMobile ? "mobile" : "desktop"}`;
    await context.addCookies([await seedSession(isMobile ? 70001 : 60001)]);
    await db().delete(editionState).where(eq(editionState.slug, slug));
    const instant = "2026-10-11T15:10:42.123Z";
    await seedEditions([
      {
        ...edition,
        slug,
        timeZone: "UTC",
        registration: {
          ...edition.registration!,
          enabled: false,
          opensAt: instant,
          withdrawUntil: null,
        },
        schedule: [{ label: "Synthetic milestone", at: instant }],
      },
    ]);
    const endpoint = `/api/admin/tournaments/${slug}`;
    const group = () =>
      page.getByRole("group", { name: "Registration opens", exact: true });
    const suffix = () => group().locator(".zoned-date-zone");
    const time = () =>
      page.getByLabel("Registration opens: time (HH:mm)", { exact: true });
    const tab = (name: string) =>
      page
        .getByRole("tablist", { name: "Tournament settings", exact: true })
        .getByRole("tab", { name, exact: true })
        .click();
    async function saveZone(zone: string) {
      await tab("General");
      await selectTimeZone(page, zone);
      const response = page.waitForResponse(
        (r) => r.url().endsWith(endpoint) && r.request().method() === "POST",
      );
      await page
        .getByRole("button", { name: "Save general settings", exact: true })
        .click();
      expect((await response).status()).toBe(200);
      await expect(page.getByRole("status")).toContainText("saved");
      await tab("Registration");
    }
    await page.goto(`/admin/tournaments/${slug}/settings?section=registration`);
    await expect(suffix()).toHaveText("UTC");
    await expect(group().getByText("UTC", { exact: true })).toHaveCount(1);
    await expect(time()).toHaveValue("15:10");
    expect(
      await suffix().evaluate((node) =>
        Boolean(
          node.previousElementSibling?.querySelector('input[type="text"]'),
        ),
      ),
    ).toBe(true);
    await tab("General");
    await selectTimeZone(page, "Asia/Hong_Kong");
    await tab("Registration");
    await expect(suffix()).toHaveText("UTC");
    await expect(time()).toHaveValue("15:10");
    await saveZone("Asia/Hong_Kong");
    await expect(suffix()).toHaveText("Asia/Hong_Kong (GMT+08:00)");
    await expect(time()).toHaveValue("23:10");
    expect(
      (await (await context.request.get(endpoint)).json()).edition.registration
        .opensAt,
    ).toBe(instant);
    await tab("Milestones");
    await expect(
      page.getByLabel("Milestone 1 time: time (HH:mm)", { exact: true }),
    ).toHaveValue("23:10");
    await expect(
      page
        .getByRole("group", {
          name: "Milestone 1 time (optional)",
          exact: true,
        })
        .locator(".zoned-date-zone"),
    ).toHaveText("Asia/Hong_Kong (GMT+08:00)");
    await saveZone("America/New_York");
    await expect(time()).toHaveValue("11:10");
    await expect(suffix()).toHaveText("America/New_York (GMT-04:00)");
    await page
      .getByLabel("Registration opens: date", { exact: true })
      .fill("2026-11-10");
    await expect(suffix()).toHaveText("America/New_York (GMT-05:00)");
    expect(
      (await (await context.request.get(endpoint)).json()).edition.registration
        .opensAt,
    ).toBe(instant);
    await page.setViewportSize({ width: isMobile ? 320 : 1440, height: 900 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await expect(page).toHaveTitle(/Tournament settings/);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
});
