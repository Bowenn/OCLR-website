"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  activeAdminLink,
  adminBreadcrumbs,
  type AdminLink,
} from "@/lib/admin-navigation";
type Workspace = {
  slug: string;
  name: string;
  season: string | null;
  status: string;
  published: boolean;
  links: AdminLink[];
};
export function StaffNavigation({
  globalLinks,
  editions,
  username,
  children,
}: {
  globalLinks: AdminLink[];
  editions: Workspace[];
  username: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [openPath, setOpenPath] = useState<string | null>(null);
  const open = openPath === pathname;
  const selected = editions.find(
    (e) =>
      pathname === `/admin/tournaments/${e.slug}` ||
      pathname.startsWith(`/admin/tournaments/${e.slug}/`),
  );
  const links = selected ? selected.links : globalLinks;
  const active = activeAdminLink(pathname, links);
  const crumbs = adminBreadcrumbs(pathname, selected);
  return (
    <div className="container page workspace admin-workspace">
      <aside className="sidebar">
        <p className="eyebrow">
          {selected ? "TOURNAMENT WORKSPACE" : "ADMINISTRATION"}
        </p>
        {selected ? (
          <div className="admin-context">
            <label className="field">
              <span>Selected tournament</span>
              <select
                aria-label="Selected tournament"
                value={selected.slug}
                onChange={(event) => {
                  setOpenPath(null);
                  router.push(
                    event.target.value
                      ? `/admin/tournaments/${event.target.value}`
                      : "/admin/tournaments",
                  );
                }}
              >
                <option value="">All tournaments</option>
                {editions.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <p className="muted small">
              {selected.season ? `Season ${selected.season} · ` : ""}
              {selected.status} · {selected.published ? "Published" : "Draft"}
            </p>
          </div>
        ) : (
          <h2>OCLR operations</h2>
        )}
        <button
          className="secondary admin-menu-toggle"
          aria-controls="admin-menu"
          aria-expanded={open}
          onClick={() => setOpenPath(open ? null : pathname)}
        >
          {open ? "Close administration menu" : "Open administration menu"}
        </button>
        <div id="admin-menu" className={`admin-menu${open ? " is-open" : ""}`}>
          <nav
            aria-label={
              selected ? "Tournament navigation" : "Administration navigation"
            }
          >
            {[...new Set(links.map((link) => link.group))].map((group) => (
              <div className="admin-nav-group" key={group}>
                <p className="eyebrow">{group}</p>
                {links
                  .filter((link) => link.group === group)
                  .map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      aria-current={
                        active?.href === link.href ? "page" : undefined
                      }
                      onClick={() => setOpenPath(null)}
                    >
                      {link.label}
                    </Link>
                  ))}
              </div>
            ))}
          </nav>
          <div className="admin-exits">
            {selected && (
              <Link href="/admin" onClick={() => setOpenPath(null)}>
                ← Administration overview
              </Link>
            )}
            <Link href="/">← Back to website</Link>
            <p className="muted small">Signed in as {username}</p>
          </div>
        </div>
      </aside>
      <div className="workspace-main">
        <nav className="admin-breadcrumbs" aria-label="Breadcrumb">
          <ol>
            {crumbs.map((crumb, i) => (
              <li key={crumb.href}>
                {i === crumbs.length - 1 ? (
                  <span aria-current="page">{crumb.label}</span>
                ) : (
                  <Link href={crumb.href}>{crumb.label}</Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        {children}
      </div>
    </div>
  );
}
