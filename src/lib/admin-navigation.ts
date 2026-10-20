import type { Capability } from "./auth/staff";
export type AdminLink = {
  href: string;
  label: string;
  group: string;
  exact?: boolean;
};
type Destination = {
  path: string;
  label: string;
  capabilities?: readonly Capability[];
};
export const globalNavigation: readonly (AdminLink & {
  capability?: Capability;
})[] = [
  { href: "/admin", label: "Overview", group: "Administration" },
  { href: "/admin/tournaments", label: "Tournaments", group: "Administration" },
  {
    href: "/admin/staff",
    label: "Staff management",
    group: "Administration",
    capability: "manage_staff",
  },
  {
    href: "/admin/audit",
    label: "Audit log",
    group: "Administration",
    capability: "manage_staff",
  },
  {
    href: "/admin/profiles",
    label: "osu! profile lookup",
    group: "Tools",
    capability: "configure_tournament",
  },
];
export const tournamentNavigation: readonly {
  label: string;
  items: readonly Destination[];
}[] = [
  {
    label: "Tournament",
    items: [
      { path: "", label: "Dashboard" },
      {
        path: "settings",
        label: "Settings",
        capabilities: ["configure_tournament"],
      },
    ],
  },
  {
    label: "Participants",
    items: [
      {
        path: "registrations",
        label: "Registrations",
        capabilities: ["manage_registrations"],
      },
      {
        path: "teams",
        label: "Players & teams",
        capabilities: ["manage_teams"],
      },
      {
        path: "captains",
        label: "Captains",
        capabilities: ["manage_captains"],
      },
      { path: "draft", label: "Live draft", capabilities: ["manage_draft"] },
    ],
  },
  {
    label: "Competition",
    items: [
      {
        path: "mappools",
        label: "Mappools",
        capabilities: ["manage_mappools"],
      },
      {
        path: "matches",
        label: "Fixtures & results",
        capabilities: ["manage_fixtures", "record_results"],
      },
    ],
  },
];
export function activeAdminLink(pathname: string, links: readonly AdminLink[]) {
  return links
    .filter(
      (link) =>
        pathname === link.href ||
        (!link.exact &&
          link.href !== "/admin" &&
          pathname.startsWith(`${link.href}/`)),
    )
    .sort((a, b) => b.href.length - a.href.length)[0];
}
export function adminBreadcrumbs(
  pathname: string,
  selected?: { slug: string; name: string; links: readonly AdminLink[] },
) {
  const crumbs = [{ href: "/admin", label: "Administration" }];
  if (selected) {
    const base = `/admin/tournaments/${selected.slug}`;
    crumbs.push(
      { href: "/admin/tournaments", label: "Tournaments" },
      { href: base, label: selected.name },
    );
    const active = activeAdminLink(pathname, selected.links);
    if (active && active.href !== base) {
      crumbs.push({ href: active.href, label: active.label });
      if (pathname !== active.href)
        crumbs.push({
          href: pathname,
          label:
            active.label === "Registrations"
              ? "Application review"
              : "Match review",
        });
    }
  } else if (pathname === "/admin/tournaments/new") {
    crumbs.push(
      { href: "/admin/tournaments", label: "Tournaments" },
      { href: pathname, label: "Create tournament" },
    );
  } else {
    const active = activeAdminLink(pathname, [
      ...globalNavigation,
      {
        href: "/admin/registrations",
        label: "All registrations",
        group: "Administration",
      },
    ]);
    if (active && active.href !== "/admin")
      crumbs.push({ href: active.href, label: active.label });
  }
  return crumbs;
}
