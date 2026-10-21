"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Avatar } from "./avatar";
type Account = { osuId: number; username: string; staff?: boolean };
function AccountControl({
  user,
  path,
  onOpen,
}: {
  user: Account;
  path: string;
  onOpen: () => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const last = useRef(false);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const items =
      root.current!.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]');
    items[last.current ? items.length - 1 : 0]?.focus();
    function outside(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    }
    function escape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        trigger.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  const content = (
    <>
      <Avatar osuId={user.osuId} username={user.username} />
      <span>Dashboard</span>
    </>
  );
  if (!user.staff)
    return (
      <Link
        href="/dashboard"
        className="button secondary account-control"
        title={user.username}
        aria-current={
          path === "/dashboard" || path.startsWith("/dashboard/")
            ? "page"
            : undefined
        }
        onClick={onOpen}
      >
        {content}
      </Link>
    );
  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    const items = [
      ...root.current!.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]'),
    ];
    const current = items.indexOf(document.activeElement as HTMLAnchorElement);
    const index =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : event.key === "ArrowUp"
              ? (current - 1 + items.length) % items.length
              : -1;
    if (index >= 0) {
      event.preventDefault();
      items[index]?.focus();
    }
    if (event.key === "Tab") setOpen(false);
    if (event.key === " ") {
      event.preventDefault();
      (event.target as HTMLAnchorElement).click();
    }
  }
  return (
    <div
      className="account-menu"
      ref={root}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="secondary account-control"
        ref={trigger}
        title={user.username}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        data-active={
          path === "/dashboard" ||
          path.startsWith("/dashboard/") ||
          path === "/admin" ||
          path.startsWith("/admin/") ||
          undefined
        }
        onClick={() => {
          last.current = false;
          onOpen();
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp"].includes(event.key)) {
            event.preventDefault();
            last.current = event.key === "ArrowUp";
            onOpen();
            setOpen(true);
          }
        }}
      >
        {content}
        <span aria-hidden="true" className="account-chevron">
          ⌄
        </span>
      </button>
      {open && (
        <div
          className="account-dropdown"
          id={id}
          role="menu"
          aria-label="Dashboards"
          onKeyDown={keyboard}
        >
          {[
            ["/dashboard", "Player dashboard"],
            ["/admin", "Staff dashboard"],
          ].map(([href, label]) => (
            <Link
              key={href}
              href={href}
              role="menuitem"
              tabIndex={-1}
              aria-current={
                path === href || path.startsWith(`${href}/`)
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
const links = [
  ["/", "Home"],
  ["/tournaments", "Tournaments"],
  ["/players", "Players"],
  ["/news", "News"],
  ["/about", "About"],
] as const;
export function Header({ user }: { user: Account | null }) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="nav-wrap">
        <Link href="/" className="brand" aria-label="OCLR home">
          OCLR
          <span className="brand-divider" />
          <span className="brand-note">osu! Chinese League Rookie</span>
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
          {user ? (
            <AccountControl
              key={path}
              user={user}
              path={path}
              onOpen={() => setOpen(false)}
            />
          ) : (
            <Link
              href="/login"
              className="button nav-login"
              aria-current={path === "/login" ? "page" : undefined}
              onClick={() => setOpen(false)}
            >
              Login with osu!<span aria-hidden="true">↗</span>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
