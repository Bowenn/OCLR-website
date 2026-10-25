import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  editionEvents,
  editionRevisions,
  editionState,
  staffRoles,
} from "../../src/db/schema";
import { seedSession } from "./session";

const translations = [
  {
    locale: "en",
    tab: "Publication",
    remove: "Delete unused draft",
    field: "Type the draft slug to confirm",
    confirm: "Confirm",
    cancel: "Cancel",
  },
  {
    locale: "zh-Hans",
    tab: "公开设置",
    remove: "删除未使用草稿",
    field: "输入草稿固定标识以确认",
    confirm: "确认",
    cancel: "取消",
  },
  {
    locale: "zh-Hant",
    tab: "公開設定",
    remove: "刪除未使用草稿",
    field: "輸入草稿固定標識以確認",
    confirm: "確認",
    cancel: "取消",
  },
];
const headers = { origin: "http://127.0.0.1:3100" };

test.describe("unused draft deletion", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(async () => closeDb());
  for (const text of translations) {
    test(`confirms and removes an unused draft in ${text.locale}`, async ({
      page,
      context,
      isMobile,
    }, info) => {
      const slug = `delete-${text.locale.toLowerCase()}-${isMobile ? "mobile" : "desktop"}-test-${randomUUID().slice(0, 8)}`;
      await context.addCookies([
        await seedSession(isMobile ? 70001 : 60001),
        {
          name: "oclr-locale",
          value: text.locale,
          domain: "127.0.0.1",
          path: "/",
        },
      ]);
      const created = await context.request.post("/api/admin/tournaments", {
        headers,
        data: { slug, name: `Synthetic ${slug}`, confirmed: true },
      });
      expect(created.status()).toBe(201);
      const endpoint = `/api/admin/tournaments/${slug}/delete-draft`;
      const payload = {
        expectedRevision: 0,
        confirmSlug: slug,
        confirmed: true,
      };
      expect(
        (
          await context.request.post(endpoint, {
            headers: { origin: "https://example.com" },
            data: payload,
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(endpoint, {
            headers: {
              ...headers,
              authorization: "Bearer synthetic-invalid-token",
            },
            data: payload,
          })
        ).status(),
      ).toBe(403);
      expect(
        (
          await context.request.post(endpoint, {
            headers,
            data: { ...payload, confirmSlug: "wrong" },
          })
        ).status(),
      ).toBe(400);

      await page.goto(
        `/admin/tournaments/${slug}/settings?section=publication`,
      );
      await page
        .getByRole("button", { name: text.remove, exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("button", { name: text.confirm, exact: true }),
      ).toBeDisabled();
      await expect(dialog).toContainText(slug);
      await dialog.getByLabel(text.field, { exact: true }).fill(slug);
      await dialog
        .getByRole("button", { name: text.cancel, exact: true })
        .click();
      await expect(dialog).toBeHidden();
      expect(
        (await context.request.get(`/api/admin/tournaments/${slug}`)).status(),
      ).toBe(200);
      await page
        .getByRole("button", { name: text.remove, exact: true })
        .click();
      for (const theme of ["light", "dark"]) {
        await context.addCookies([
          { name: "oclr-theme", value: theme, domain: "127.0.0.1", path: "/" },
        ]);
        await page.reload();
        await page
          .getByRole("button", { name: text.remove, exact: true })
          .click();
        await dialog.getByLabel(text.field, { exact: true }).fill(slug);
        if (isMobile) await page.setViewportSize({ width: 320, height: 844 });
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        expect(
          (
            await new AxeBuilder({ page })
              .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
              .analyze()
          ).violations,
        ).toEqual([]);
        await page.screenshot({
          path: info.outputPath(`delete-${text.locale}-${theme}.png`),
          fullPage: true,
          animations: "disabled",
        });
      }
      await dialog
        .getByRole("button", { name: text.confirm, exact: true })
        .click();
      await expect(page).toHaveURL(/\/admin\/tournaments$/);
      expect(
        (await context.request.get(`/api/admin/tournaments/${slug}`)).status(),
      ).toBe(404);
      expect(
        (await context.request.get(`/api/tournaments/${slug}`)).status(),
      ).toBe(404);
      const list = await (
        await context.request.get("/api/admin/tournaments")
      ).json();
      expect(list.rows.some((row: { slug: string }) => row.slug === slug)).toBe(
        false,
      );
      expect(
        await db()
          .select()
          .from(editionRevisions)
          .where(eq(editionRevisions.editionSlug, slug)),
      ).toHaveLength(1);
      expect(
        await db()
          .select()
          .from(editionEvents)
          .where(eq(editionEvents.editionSlug, slug)),
      ).toHaveLength(2);
      expect(
        (
          await context.request.post(endpoint, { headers, data: payload })
        ).status(),
      ).toBe(404);
      expect(
        (
          await context.request.post("/api/admin/tournaments", {
            headers,
            data: { slug, name: "Reused slug", confirmed: true },
          })
        ).status(),
      ).toBe(409);
    });
  }
  test("denies unauthenticated, scoped and stale requests and protects newly saved content", async ({
    page,
    context,
    browser,
    isMobile,
  }) => {
    const adminId = isMobile ? 70001 : 60001;
    const limitedId = isMobile ? 327102 : 327101;
    const slug = `protected-delete-${isMobile ? "mobile" : "desktop"}-test-${randomUUID().slice(0, 8)}`;
    await context.addCookies([await seedSession(adminId)]);
    const created = await context.request.post("/api/admin/tournaments", {
      headers,
      data: { slug, name: "Synthetic protected draft", confirmed: true },
    });
    expect(created.status()).toBe(201);
    const original = await created.json();
    const endpoint = `/api/admin/tournaments/${slug}/delete-draft`;
    const payload = { expectedRevision: 0, confirmSlug: slug, confirmed: true };
    const guest = await browser.newContext();
    const limited = await browser.newContext();
    try {
      expect(
        (
          await guest.request.post(`http://127.0.0.1:3100${endpoint}`, {
            headers,
            data: payload,
          })
        ).status(),
      ).toBe(401);
      await limited.addCookies([await seedSession(limitedId)]);
      await db().insert(staffRoles).values({
        userId: limitedId,
        role: "admin",
        editionSlug: slug,
        grantedBy: adminId,
      });
      expect(
        (
          await limited.request.post(`http://127.0.0.1:3100${endpoint}`, {
            headers,
            data: payload,
          })
        ).status(),
      ).toBe(403);
      const limitedPage = await limited.newPage();
      await limitedPage.goto(
        `http://127.0.0.1:3100/admin/tournaments/${slug}/settings?section=publication`,
      );
      await expect(
        limitedPage.getByRole("button", {
          name: /Delete unused draft|删除未使用草稿/,
        }),
      ).toHaveCount(0);
      await page.goto(
        `/admin/tournaments/${slug}/settings?section=publication`,
      );
      await page
        .getByRole("button", { name: "Delete unused draft", exact: true })
        .click();
      const dialog = page.getByRole("dialog");
      await dialog.getByLabel("Type the draft slug to confirm").fill(slug);
      const general = await context.request.post(
        `/api/admin/tournaments/${slug}`,
        {
          headers,
          data: {
            action: "general",
            expectedRevision: 0,
            confirmed: true,
            name: original.edition.name,
            season: null,
            summary: "New content",
            timeZone: "UTC",
            branding: original.edition.branding,
            status: "upcoming",
          },
        },
      );
      expect(general.status()).toBe(200);
      await dialog
        .getByRole("button", { name: "Confirm", exact: true })
        .click();
      await expect(page.getByRole("status")).toContainText("settings changed");
      expect(
        (
          await context.request.post(endpoint, {
            headers,
            data: { ...payload, expectedRevision: 1 },
          })
        ).status(),
      ).toBe(409);
      expect(
        (await context.request.get(`/api/admin/tournaments/${slug}`)).status(),
      ).toBe(200);
      expect(
        (
          await db()
            .select()
            .from(editionState)
            .where(eq(editionState.slug, slug))
        )[0].configuration,
      ).not.toBeNull();
    } finally {
      await guest.close();
      await limited.close();
    }
  });
});
