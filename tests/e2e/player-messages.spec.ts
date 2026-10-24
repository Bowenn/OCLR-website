import { test, expect } from "@playwright/test";
import { db, closeDb } from "../../src/db";
import { registrations, users } from "../../src/db/schema";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { seedSession } from "./session";

test.describe("player identity, introduction and signed messages", () => {
  test.skip(!process.env.TEST_DATABASE_URL, "Requires isolated PostgreSQL");
  test.afterAll(closeDb);
  test("renders real answer projection, authenticates messages and preserves signatures", async ({
    page,
    context,
    isMobile,
  }, info) => {
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const base = isMobile ? 321010 : 321000;
    const slug = `player-message-${base}-test`;
    const cookie = await seedSession(base);
    await seedEditions([
      {
        ...edition,
        slug,
        registration: {
          ...edition.registration!,
          publicIntroductionQuestionId: "intro",
          questions: [
            {
              id: "intro",
              label: "Self introduction",
              type: "text",
              required: false,
              maxLength: 500,
            },
          ],
        },
      },
    ]);
    await db()
      .insert(users)
      .values({ osuId: base + 1, username: "Synthetic Introduction Player" })
      .onConflictDoNothing();
    await db()
      .insert(registrations)
      .values({
        editionSlug: slug,
        userId: base + 1,
        status: "accepted",
        configurationVersion: 0,
        answers: {
          intro: "Literal submitted introduction\nsecond line",
          private: "NEVER_PUBLIC_CONTACT",
        },
      })
      .onConflictDoNothing();
    const path = `/tournaments/${slug}/players`;
    const endpoint = `/api/tournaments/${slug}/players/${base + 1}/messages`;
    const unsigned = await context.request.post(endpoint, {
      headers: { Origin: "http://127.0.0.1:3100" },
      data: { requestId: crypto.randomUUID(), text: "Unauthenticated" },
    });
    expect(unsigned.status()).toBe(401);
    await page.route("https://a.ppy.sh/**", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect width="88" height="88" fill="#7650a0"/></svg>',
      }),
    );
    await page.goto(path);
    await expect(
      page.getByRole("link", {
        name: "Sign in with osu! to leave a signed message",
      }),
    ).toBeVisible();
    await expect(page.locator(".event-player-bio")).toContainText(
      "Literal submitted introduction",
    );
    await expect(page.locator(".event-player-row")).not.toContainText(
      "NEVER_PUBLIC_CONTACT",
    );
    await expect(page.locator(".event-player-identity img")).toHaveAttribute(
      "src",
      `https://a.ppy.sh/${base + 1}`,
    );
    await context.addCookies([cookie]);
    await page.reload();
    const message = "Literal signed message <script>text</script>";
    await page
      .getByLabel("Leave a signed message for Synthetic Introduction Player", {
        exact: true,
      })
      .fill(message);
    await page
      .getByRole("button", { name: "Post message", exact: true })
      .click();
    await expect(page.locator(".event-message-scroll")).toContainText(message);
    await expect(page.locator(".event-message-scroll")).toContainText(
      `Synthetic Player ${base}`,
    );
    await page.reload();
    await expect(page.locator(".event-message-scroll")).toContainText(message);
    const forged = await context.request.post(endpoint, {
      headers: { Origin: "http://127.0.0.1:3100" },
      data: {
        requestId: crypto.randomUUID(),
        text: "forged",
        authorId: base + 1,
      },
    });
    expect(forged.status()).toBe(400);
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
        await page.setViewportSize({
          width: isMobile ? 320 : 1440,
          height: 1000,
        });
        await page.reload();
        await expect(page.locator(".event-message-scroll")).toContainText(
          message,
        );
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true);
        await page.evaluate(() => {
          (document.activeElement as HTMLElement | null)?.blur();
          window.scrollTo(0, 0);
        });
        await page.screenshot({
          path: info.outputPath(`player-${appearance}-${theme}.png`),
          fullPage: true,
        });
      }
  });
});
