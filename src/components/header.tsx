"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
const links = [
  ["/", "Home"],
  ["/tournaments", "Tournaments"],
  ["/players", "Players"],
  ["/news", "News"],
  ["/about", "About"],
] as const;
export function Header({
  user,
}: {
  user: { username: string; staff?: boolean } | null;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="site-header">
      <div className={`nav-wrap${user?.staff ? " staff-header" : ""}`}>
        <Link href="/" className="brand" aria-label="OCLR home">
          <span className="brand-mark" aria-hidden="true">
            o!
          </span>
          OCLR
          <span className="brand-divider" />
          <span className="brand-note">THE ROOKIE STAGE</span>
        </Link>
        <button
          className="menu-toggle secondary"
          aria-expanded={open}
          aria-controls="main-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close" : "Menu"}
        </button>
        <nav
          id="main-navigation"
          aria-label="Main navigation"
          className={open ? "main-nav open" : "main-nav"}
        >
          {links.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                (
                  href === "/"
                    ? path === "/"
                    : path === href || path.startsWith(`${href}/`)
                )
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="nav-actions" role="group" aria-label="Account actions">
          {user?.staff && (
            <Link
              href="/admin"
              className="button secondary nav-login"
              aria-current={
                path === "/admin" || path.startsWith("/admin/")
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              Staff dashboard
            </Link>
          )}
          <Link
            href={user ? "/dashboard" : "/login"}
            className="button nav-login"
            aria-current={
              (
                user
                  ? path === "/dashboard" || path.startsWith("/dashboard/")
                  : path === "/login"
              )
                ? "page"
                : undefined
            }
            onClick={() => setOpen(false)}
          >
            {user ? "Player dashboard" : "Login with osu!"}
            <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
