import { expect, test } from "@playwright/test";
test("shared navigation works at desktop and mobile widths", async ({
  page,
  isMobile,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle("OCLR — osu! Chinese League Rookie");
  if (isMobile)
    await page.getByRole("button", { name: "Menu", exact: true }).click();
  await page
    .getByRole("navigation", { name: "Main navigation" })
    .getByRole("link", { name: "Tournaments" })
    .click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Tournament",
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
  await page.getByRole("link", { name: "Privacy", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});
test("landing page has honest CTAs and readable original artwork", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "osu! Chinese League Rookie",
  );
  await expect(
    page.locator(".highlights, .workflow-section, .edition-card"),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Latest news", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Next milestone", exact: true }),
  ).toBeVisible();
  if (process.env.TEST_DATABASE_URL) {
    const name = (await page.locator(".hero-kicker").textContent())?.trim();
    const published = await (await page.request.get("/api/tournaments")).json();
    expect(
      published.some((edition: { name: string }) => edition.name === name),
    ).toBe(true);
  } else
    await expect(
      page.getByText("The next edition has not been announced yet."),
    ).toBeVisible();
  await page.goto("/");
  await page.screenshot({
    path: testInfo.outputPath("home.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByRole("link", { name: "View tournament", exact: false })
    .first()
    .click();
  await expect(page).toHaveURL(/\/tournaments(?:\/[a-z0-9-]+)?$/);
});
test("news is approved content only and about uses the official identity", async ({
  page,
}) => {
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "osu! Chinese League Rookie",
  );
  await expect(page.locator(".page-heading")).toContainText("Founded in 2018");
  await expect(page.locator(".page-heading")).toContainText(
    "OCL tournament series, whose history dates back to 2014",
  );
  await expect(
    page.getByRole("link", { name: /Explore tournaments|Latest news/ }),
  ).toHaveCount(0);
  await page.goto("/news");
  if (process.env.TEST_DATABASE_URL) {
    await page
      .getByRole("link", { name: /Synthetic test announcement/ })
      .click();
    await expect(
      page.getByRole("heading", { name: "Synthetic fixture section" }),
    ).toBeVisible();
    await expect(page.getByText(/Plain text is escaped/)).toContainText(
      "<script>",
    );
    expect((await page.goto("/news/private-announcement"))?.status()).toBe(404);
  } else
    await expect(
      page.getByRole("heading", { name: "No announcements yet" }),
    ).toBeVisible();
});

test("Privacy and About share one explicit osu! contact without publishing the admin allowlist", async ({
  page,
  context,
}, info) => {
  test.skip(
    !process.env.TEST_DATABASE_URL,
    "Requires synthetic contact configuration",
  );
  await page.goto("/privacy");
  const contact = page.getByRole("link", {
    name: "Contact OCLR Admin on osu!",
    exact: false,
  });
  await expect(contact).toHaveCount(1);
  await expect(contact).toHaveAttribute(
    "href",
    "https://osu.ppy.sh/users/60001",
  );
  await expect(
    page.getByText("Synthetic isolated browser-test policy."),
  ).toBeVisible();
  await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
  const html = await page.content();
  for (const hidden of [
    "70001",
    "110001",
    "120001",
    "synthetic-browser-provider-secret",
    "private-contact@example.test",
  ])
    expect(html).not.toContain(hidden);
  expect(await context.cookies()).toEqual([]);
  await page.screenshot({
    path: info.outputPath("privacy-osu-contact.png"),
    fullPage: true,
    animations: "disabled",
  });
  await page.goto("/about");
  await expect(
    page.getByRole("link", {
      name: "Contact OCLR Admin on osu!",
      exact: false,
    }),
  ).toHaveAttribute("href", "https://osu.ppy.sh/users/60001");
});
