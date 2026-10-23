import { describe, expect, it } from "vitest";
import {
  activeAdminLink,
  adminBreadcrumbs,
  globalNavigation,
  tournamentNavigation,
} from "../../src/lib/admin-navigation";
const base = "/admin/tournaments/s11";
const links = tournamentNavigation.flatMap((g) =>
  g.items.map((item) => ({
    href: base + (item.path ? `/${item.path}` : ""),
    label: item.label,
    group: g.label,
    exact: item.path === "",
  })),
);
const edition = { slug: "s11", name: "OCLR Season 11", links };
describe("administration location", () => {
  it("selects only the most specific route with segment boundaries", () => {
    expect(activeAdminLink(base, links)?.label).toBe("Dashboard");
    expect(activeAdminLink(`${base}/mappools`, links)?.label).toBe("Mappools");
    expect(activeAdminLink(`${base}/rounds`, links)?.label).toBe("Rounds");
    expect(
      adminBreadcrumbs(`${base}/rounds`, edition).map((crumb) => crumb.label),
    ).toEqual(["Administration", "Tournaments", "OCLR Season 11", "Rounds"]);
    expect(activeAdminLink(`${base}/matches/fixture`, links)?.label).toBe(
      "Fixtures & results",
    );
    expect(activeAdminLink(`${base}/matches-other`, links)).toBeUndefined();
    expect(
      activeAdminLink("/admin/tournaments/s110/mappools", links),
    ).toBeUndefined();
    expect(activeAdminLink("/admin", globalNavigation)?.label).toBe("Overview");
    expect(activeAdminLink("/admin/staff", globalNavigation)?.label).toBe(
      "Staff management",
    );
  });
  it("builds scoped breadcrumbs for nested operational pages", () => {
    expect(
      adminBreadcrumbs(`${base}/matches/fixture`, edition).map((c) => c.label),
    ).toEqual([
      "Administration",
      "Tournaments",
      "OCLR Season 11",
      "Fixtures & results",
      "Match review",
    ]);
    expect(
      adminBreadcrumbs(`${base}/registrations/application`, edition).at(-1)
        ?.label,
    ).toBe("Application review");
    expect(adminBreadcrumbs(base, edition).at(-1)).toEqual({
      href: base,
      label: edition.name,
    });
  });
  it("keeps global tools and creation outside an edition context", () => {
    expect(adminBreadcrumbs("/admin/settings").map((c) => c.label)).toEqual([
      "Administration",
      "Site settings",
    ]);
    expect(
      globalNavigation.find((link) => link.href === "/admin/settings"),
    ).toMatchObject({
      globalOnly: true,
      capability: "configure_tournament",
    });
    expect(
      adminBreadcrumbs("/admin/tournaments/new").map((c) => c.label),
    ).toEqual(["Administration", "Tournaments", "Create tournament"]);
    expect(adminBreadcrumbs("/admin/staff").map((c) => c.label)).toEqual([
      "Administration",
      "Staff management",
    ]);
  });
  it("keeps standalone lookup utilities out of the administration destinations", () => {
    expect(
      globalNavigation.some(
        (item) => item.href === "/admin/profiles" || item.group === "Tools",
      ),
    ).toBe(false);
  });
});
