"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useId, useRef, useState, type ReactNode } from "react";
import { publicTournamentSection } from "@/lib/public-navigation";

function Navigation({
  slug,
  liveDraft,
  mobileMenu = false,
}: {
  slug: string;
  liveDraft: boolean;
  mobileMenu?: boolean;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const base = `/tournaments/${slug}`;
  const links = [
    ["", "Overview"],
    ["schedule", "Schedule"],
    ["mappools", "Mappools"],
    ["teams", "Teams"],
    ["rules", "Rules"],
    ["results", "Results"],
    ["bracket", "Bracket"],
    ["players", "Players"],
    ["participants", "Captains & rosters"],
    ...(liveDraft ? [["draft", "Live draft"]] : []),
  ];
  const active = publicTournamentSection(pathname, base);
  return (
    <div
      className="tournament-navigation"
      data-open={open || undefined}
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      {mobileMenu && (
        <button
          ref={trigger}
          type="button"
          className="secondary tournament-menu"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
        >
          Tournament menu <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      )}
      <nav id={id} aria-label="Tournament navigation">
        {links.map(([section, label]) => (
          <Link
            key={section}
            href={`${base}${section ? `/${section}` : ""}`}
            aria-current={active === section ? "page" : undefined}
            onClick={() => setOpen(false)}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
export function TournamentNavigation(props: {
  slug: string;
  liveDraft: boolean;
  mobileMenu?: boolean;
}) {
  const path = usePathname();
  return <Navigation key={path} {...props} />;
}

/** Private captain tools and OBS retain the existing dark workspace. */
export function TournamentShell({
  slug,
  name,
  season,
  liveDraft,
  children,
}: {
  slug: string;
  name: string;
  season: string | null;
  liveDraft: boolean;
  children: ReactNode;
}) {
  const path = usePathname();
  const base = `/tournaments/${slug}`;
  const privateView =
    path === `${base}/team` ||
    path.startsWith(`${base}/draft/captain`) ||
    path.includes("/draft/overlay");
  if (privateView)
    return (
      <div className="container page workspace tournament-workspace">
        <aside className="sidebar">
          <Link href="/tournaments" className="eyebrow">
            Tournaments
          </Link>
          <h2>{name}</h2>
          <TournamentNavigation slug={slug} liveDraft={liveDraft} />
        </aside>
        <div className="workspace-main">{children}</div>
      </div>
    );
  return (
    <div className="public-tournament">
      <div className="event-context">
        <div className="event-identity">
          <Link href="/tournaments" className="text-link">
            Tournaments
          </Link>
          <span aria-hidden="true">/</span>
          <Link href={base}>{name}</Link>
          {season && <span className="badge">Season {season}</span>}
        </div>
        <TournamentNavigation slug={slug} liveDraft={liveDraft} mobileMenu />
      </div>
      <div className="event-content">{children}</div>
    </div>
  );
}
