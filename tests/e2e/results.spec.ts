import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { closeDb } from "../../src/db";
import { seedSession } from "./session";
import { seedResultReview } from "../fixtures/results";
test.describe("private referee review and Admin publication", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  test("reviewed synthetic games require separate approval and publish, with persistent audit", async ({
    page,
    context,
    browser,
    isMobile,
  }, info) => {
    const adminId = isMobile ? 70001 : 60001;
    const refereeId = isMobile ? 302002 : 301002;
    const adminCookie = await seedSession(adminId);
    const refCookie = await seedSession(refereeId);
    const seed = await seedResultReview(
      adminId,
      refereeId,
      isMobile ? 304000 : 303000,
    );
    await context.addCookies([refCookie]);
    const endpoint = `/api/admin/tournaments/test-cup/matches/${seed.fixtureId}/results`;
    const route = `/admin/tournaments/test-cup/matches/${seed.fixtureId}`;
    const headers = { origin: "http://127.0.0.1:3100" };
    const guest = await browser.newContext({
      baseURL: "http://127.0.0.1:3100",
    });
    try {
      expect((await guest.request.get(endpoint)).status()).toBe(401);
      const publicEndpoint = `/api/tournaments/test-cup/matches/${seed.fixtureId}`;
      const beforePublication = await (
        await guest.request.get(publicEndpoint)
      ).json();
      expect(beforePublication.result).toBeNull();
      expect(JSON.stringify(beforePublication)).not.toContain("999001");
      expect(
        (
          await guest.request.post(publicEndpoint, {
            data: { action: "publish" },
          })
        ).status(),
      ).toBe(405);

      await page.goto(route);
      await page
        .getByLabel("Internal operation reason")
        .fill("Synthetic reviewed game evidence; private audit note");
      for (let i = 1; i <= 3; i++) {
        await page
          .getByText(new RegExp(`^Game ${i} · Synthetic Map ${i}`))
          .click();
        await page
          .getByRole("combobox", { name: new RegExp(`^Game ${i} decision`) })
          .selectOption("true");
        await page
          .getByLabel(`Game ${i} review reason`, { exact: true })
          .fill("Synthetic map confirmed against fixture evidence");
        await page
          .getByLabel(
            `Game ${i}: I verified mods and the approved tournament rules`,
            { exact: true },
          )
          .check();
      }
      await page
        .getByLabel(
          "I verified the configured scoring rules against the approved OCLR rules",
          { exact: true },
        )
        .check();
      await page
        .getByLabel(
          "I reviewed the current source snapshot and all reported changes",
          { exact: true },
        )
        .check();
      await expect(
        page.getByRole("button", {
          name: "Submit proposed result",
          exact: true,
        }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Submit proposed result", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByText("Current revision: 1 · Published revision: None"),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Approve proposed result" }),
      ).toHaveCount(0);
      let review = await (await context.request.get(endpoint)).json();
      const command = {
        requestKey: randomUUID(),
        expectedVersion: review.context.result.version,
        expectedFixtureVersion: review.context.fixture.version,
        confirmed: true,
        reason: "Synthetic unauthorized approval",
        action: "approve",
        revision: 1,
      };
      expect(
        (
          await context.request.post(endpoint, { headers, data: command })
        ).status(),
      ).toBe(403);
      expect(
        (
          await guest.request.post(endpoint, { headers, data: command })
        ).status(),
      ).toBe(401);
      await context.addCookies([adminCookie]);
      await page.reload();
      await page
        .getByLabel("Internal operation reason")
        .fill("Synthetic Admin approval after review");
      await page
        .getByRole("button", { name: "Approve proposed result", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByText("Current proposal: 2 : 1 · Approved", { exact: true }),
      ).toBeVisible();
      await page
        .getByLabel(
          "I reviewed the effect on dependent fixtures and public standings or brackets",
          { exact: true },
        )
        .check();
      await page
        .getByRole("button", { name: "Publish approved result", exact: true })
        .click();
      await page.getByRole("button", { name: "Confirm", exact: true }).click();
      await expect(
        page.getByText("Current revision: 1 · Published revision: 1"),
      ).toBeVisible();
      await page.reload();
      await expect(
        page.getByText("Current revision: 1 · Published revision: 1"),
      ).toBeVisible();
      review = await (await context.request.get(endpoint)).json();
      const published = await (await guest.request.get(publicEndpoint)).json();
      expect(published.result).toMatchObject({
        homeWins: 2,
        awayWins: 1,
        revision: 1,
        mpId: 999001,
      });
      const publicText = JSON.stringify(published);
      for (const secret of [
        "private audit note",
        "SYNTHETIC_PRIVATE_CONTACT",
        "rosterSnapshot",
        "decisions",
        "sourceFingerprint",
        "approvedBy",
      ])
        expect(publicText).not.toContain(secret);
      expect(review.published.proposal.series).toMatchObject({
        homeWins: 2,
        awayWins: 1,
      });
      expect(
        review.context.events.map((e: { action: string }) => e.action),
      ).toEqual(
        expect.arrayContaining([
          "result_submit",
          "result_approve",
          "result_publish",
        ]),
      );
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
      await page.screenshot({
        path: info.outputPath("referee-review.png"),
        fullPage: true,
        animations: "disabled",
      });
    } finally {
      await guest.close();
    }
  });
});
