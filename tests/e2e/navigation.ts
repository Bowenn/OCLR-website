import type { Page } from "@playwright/test";
/** Enter an operational tool through the same global/edition hierarchy as staff. */
export async function openTournamentTool(
  page: Page,
  slug: string,
  tool: string,
  mobile: boolean,
) {
  await page.goto("/admin");
  await page
    .getByRole("link", { name: /^(Manage tournaments|Assigned tournaments)$/ })
    .click();
  await page.locator(`a[href="/admin/tournaments/${slug}"]`).click();
  if (mobile)
    await page
      .getByRole("button", { name: "Open administration menu", exact: true })
      .click();
  await page
    .getByRole("navigation", { name: "Tournament navigation", exact: true })
    .getByRole("link", { name: tool, exact: true })
    .click();
}
