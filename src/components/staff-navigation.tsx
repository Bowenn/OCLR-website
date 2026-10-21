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
        {!selected && <p className="eyebrow">ADMINISTRATION</p>}
        {selected ? (
          <div className="admin-context">
            <div className="admin-context-heading">
              <span className="muted small">Tournament</span>
              {!selected.published ? (
                <span className="badge">Draft</span>
              ) : selected.status === "live" ? (
                <span className="badge">Live</span>
              ) : null}
            </div>
            <label className="field">
              <span className="sr-only">Selected tournament</span>
              <select
                aria-label="Selected tournament"
                value={selected.slug}
                onChange={(event) => {
                  setOpenPath(null);
                  const next = editions.find(
                    (edition) => edition.slug === event.target.value,
                  );
                  if (next) router.push(`/admin/tournaments/${next.slug}`);
                }}
              >
                {editions.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
            <Link
              href="/admin/tournaments"
              className="button secondary admin-return"
              onClick={() => setOpenPath(null)}
            >
              ← All tournaments
            </Link>
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
                {!(selected && group === "Tournament") && (
                  <p className="eyebrow">{group}</p>
                )}
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
          <p className="admin-identity muted small">Signed in as {username}</p>
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
