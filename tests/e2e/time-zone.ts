import type { Page, Locator } from "@playwright/test";
/** Choose a named IANA zone using the same searchable widget as an organizer. */
export async function selectTimeZone(scope: Page | Locator, zone: string) {
  await scope.getByRole("button", { name: "Time zone", exact: true }).click();
  await scope
    .getByRole("combobox", { name: "Search time zones", exact: true })
    .fill(zone);
  await scope
    .getByRole("listbox", { name: "Time zones", exact: true })
    .getByRole("option")
    .filter({ hasText: zone })
    .click();
}
