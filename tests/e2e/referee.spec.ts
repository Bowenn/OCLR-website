import { test, expect } from "@playwright/test";
import { db, closeDb } from "../../src/db";
import { staffRoles, users } from "../../src/db/schema";
import { createSession } from "../../src/lib/auth/sessions";
import {
  seedRefereeFixture,
  refereeTestAdmin,
  refereeTestUser,
} from "../fixtures/referee";
import { seedBrowserEditions } from "./setup";
import { assertTestDatabase } from "../database";
import { appearances } from "../../src/lib/preferences";
import { englishStorage } from "../fixtures/preferences";
import type { RefereeWorkspace } from "../../src/lib/referee";

async function seed() {
  assertTestDatabase(process.env.TEST_DATABASE_URL);
  if (
    new URL(process.env.TEST_DATABASE_URL!).pathname === "/oclr_frontend_test"
  )
    throw new Error("Never run against the local preview database.");
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  await seedBrowserEditions();
  const fixture = await seedRefereeFixture();
  await db()
    .insert(staffRoles)
    .values({
      userId: refereeTestAdmin.osuId,
      editionSlug: "test-cup",
      role: "admin",
      grantedBy: refereeTestAdmin.osuId,
    })
    .onConflictDoNothing();
  const session = await createSession(refereeTestUser.osuId);
  return {
    ...fixture,
    cookie: {
      name: "oclr_session",
      value: session.token,
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      sameSite: "Lax" as const,
      secure: false,
    },
  };
}

test.describe("referee command workspace", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("copies commands, applies independent order, records replay and reloads without publishing", async ({
    page,
    context,
    browser,
    isMobile,
    baseURL,
  }) => {
    test.setTimeout(120000);
    const seeded = await seed();
    await context.addCookies([seeded.cookie]);
    if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async (text: string) => {
            (window as unknown as { lastCopied: string }).lastCopied = text;
          },
        },
      });
    });
    const path = `/admin/tournaments/test-cup/matches/${seeded.fixtureId}/referee`;
    const api = `/api/admin/tournaments/test-cup/matches/${seeded.fixtureId}/referee`;
    const read = async () =>
      (await (await context.request.get(api)).json()) as RefereeWorkspace;
    await page.goto("/admin/tournaments/test-cup/matches");
    await page
      .getByRole("link", { name: "Referee panel", exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`${seeded.fixtureId}/referee$`));
    await expect(
      page.getByRole("heading", { name: "Command assistant", exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Configure round referee policy", { exact: true }),
    ).toHaveCount(0);
    const [home, away] = seeded.workspace.teams;
    for (const [ban, pick] of [
      [home.id, home.id],
      [home.id, away.id],
      [away.id, home.id],
      [away.id, away.id],
    ]) {
      await page
        .getByLabel("First Ban team", { exact: true })
        .selectOption(ban);
      await page
        .getByLabel("First Pick team", { exact: true })
        .selectOption(pick);
      await page
        .getByRole("button", { name: "Apply order", exact: true })
        .click();
      await expect
        .poll(async () => {
          const w = await read();
          return [w.session?.firstBanTeamId, w.session?.firstPickTeamId];
        })
        .toEqual([ban, pick]);
    }
    await page
      .getByLabel("First Ban team", { exact: true })
      .selectOption(home.id);
    await page
      .getByLabel("First Pick team", { exact: true })
      .selectOption(away.id);
    await page
      .getByRole("button", { name: "Apply order", exact: true })
      .click();
    await expect(
      page.getByText("Showing applied order", { exact: true }),
    ).toBeVisible();
    const pool = page.getByRole("region", {
      name: "Round mappool",
      exact: true,
    });
    await pool.getByRole("button", { name: /NM1/ }).click();
    const beforeCopy = (await read()).events.length;
    await page
      .getByRole("button", { name: "Copy Change beatmap", exact: true })
      .click();
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as unknown as { lastCopied: string }).lastCopied,
        ),
      )
      .toBe("!mp map 10001 0");
    expect((await read()).events).toHaveLength(beforeCopy);
    await page.evaluate(() =>
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          writeText: async () => {
            throw new Error("synthetic clipboard denial");
          },
        },
      }),
    );
    await page
      .getByRole("button", { name: "Copy Abort game", exact: true })
      .click();
    await expect(
      page.getByText(
        "Clipboard unavailable. Select the command and copy it manually.",
        { exact: true },
      ),
    ).toBeVisible();
    expect((await read()).events).toHaveLength(beforeCopy);
    await page
      .getByRole("button", { name: "Record selected Ban / Pick", exact: true })
      .click();
    await expect
      .poll(async () => (await read()).projection.activeSelections.length)
      .toBe(1);
    await pool.getByRole("button", { name: /NM2/ }).click();
    await page
      .getByRole("button", { name: "Record selected Ban / Pick", exact: true })
      .click();
    await expect
      .poll(async () => (await read()).projection.activeSelections.length)
      .toBe(2);
    const win = page.getByRole("button", {
      name: `Record win: ${home.name}`,
      exact: true,
    });
    await win.click();
    await expect
      .poll(async () => (await read()).projection.score[home.id])
      .toBe(1);
    await page
      .getByRole("button", { name: `Record win: ${away.name}`, exact: true })
      .click();
    await expect
      .poll(async () => (await read()).projection.score[away.id])
      .toBe(1);
    await page.getByText("Full correction history", { exact: true }).click();
    await expect(
      page.getByText(
        `Completed · Winner: ${home.name} → Completed · Winner: ${away.name}`,
        { exact: false },
      ),
    ).toBeVisible();
    await page.getByText("Full correction history", { exact: true }).click();
    await win.click();
    await expect
      .poll(async () => (await read()).projection.score[home.id])
      .toBe(1);

    await page
      .getByRole("button", { name: "Record replay", exact: true })
      .click();
    await expect
      .poll(async () => (await read()).projection.score[home.id])
      .toBe(0);
    await page
      .getByRole("button", { name: "Record abort", exact: true })
      .click();
    await expect
      .poll(
        async () =>
          (await read()).projection.activeSelections[1].attempts.at(-1)?.status,
      )
      .toBe("aborted");
    await page
      .getByRole("button", { name: "Record replay", exact: true })
      .click();
    await page
      .getByRole("button", { name: `Record win: ${away.name}`, exact: true })
      .click();
    await expect
      .poll(async () => (await read()).projection.score[away.id])
      .toBe(1);
    await page.reload();
    await expect(page.getByText(/^Attempt 3 · Completed · Winner:/)).toBeVisible();
    expect((await read()).projection.activeSelections[1].attempts).toHaveLength(
      3,
    );
    await page
      .getByRole("button", { name: "Withdraw last Ban / Pick", exact: true })
      .click();
    await expect
      .poll(async () => (await read()).projection.activeSelections.length)
      .toBe(1);
    expect((await read()).projection.score[away.id]).toBe(0);
    await page
      .getByRole("link", { name: "Post-match review", exact: true })
      .first()
      .click();
    await expect(page).toHaveURL(new RegExp(`${seeded.fixtureId}$`));
    await expect(
      page.getByRole("link", { name: "Referee panel", exact: true }),
    ).toBeVisible();
    const guest = await browser.newContext({
      storageState: englishStorage,
      baseURL,
    });
    expect((await guest.request.get(api)).status()).toBe(401);
    const outsiderId = 891099;
    await db()
      .insert(users)
      .values({ osuId: outsiderId, username: "Synthetic Unassigned Referee" })
      .onConflictDoNothing();
    await db()
      .insert(staffRoles)
      .values({
        userId: outsiderId,
        editionSlug: "test-cup",
        role: "referee",
        grantedBy: refereeTestAdmin.osuId,
      })
      .onConflictDoNothing();
    const outsider = await createSession(outsiderId);
    await guest.addCookies([{ ...seeded.cookie, value: outsider.token }]);
    expect((await guest.request.get(api)).status()).toBe(403);
    const deniedPage = await guest.newPage();
    expect((await deniedPage.goto(path))?.status()).toBe(404);
    await guest.close();
  });
  test("keeps every appearance usable in light/dark and all locales", async ({
    page,
    context,
    isMobile,
    baseURL,
  }, info) => {
    test.setTimeout(180000);
    const seeded = await seed();
    await context.addCookies([seeded.cookie]);
    const path = `/admin/tournaments/test-cup/matches/${seeded.fixtureId}/referee`;
    const width = isMobile ? 320 : 1440;
    await page.setViewportSize({ width, height: 900 });
    for (const appearance of appearances)
      for (const theme of ["light", "dark"]) {
        await context.addCookies([
          {
            name: "oclr-appearance",
            value: appearance,
            url: baseURL!,
          },
          { name: "oclr-theme", value: theme, url: baseURL! },
        ]);
        await page.goto(path);
        await expect(
          page.getByRole("heading", { name: "Command assistant", exact: true }),
        ).toBeVisible();
        expect(
          await page.evaluate(() => document.documentElement.scrollWidth),
          `${appearance} ${theme} ${width}`,
        ).toBeLessThanOrEqual(width);
        await page.screenshot({
          path: info.outputPath(`referee-${appearance}-${theme}-${width}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
    for (const locale of ["zh-Hans", "zh-Hant", "en"]) {
      await context.addCookies([
        { name: "oclr-locale", value: locale, url: baseURL! },
      ]);
      await page.goto(path);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await page.screenshot({
        path: info.outputPath(`referee-${locale}-${width}.png`),
        fullPage: true,
        animations: "disabled",
      });
    }
  });
});
