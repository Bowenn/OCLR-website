"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

/** Same public destinations, with an exact overview and one active section. */
export function TournamentNavigation({
  slug,
  liveDraft,
}: {
  slug: string;
  liveDraft: boolean;
}) {
  const pathname = usePathname();
  const navigation = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = navigation.current;
    const active = node?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!node || !active || node.scrollWidth <= node.clientWidth) return;
    const parent = node.getBoundingClientRect();
    const current = active.getBoundingClientRect();
    node.scrollLeft +=
      current.left - parent.left - (node.clientWidth - current.width) / 2;
  }, [pathname]);
  const base = `/tournaments/${slug}`;
  const links = [
    [base, "Overview"],
    [`${base}/rules`, "Rules"],
    [`${base}/schedule`, "Schedule"],
    [`${base}/mappools`, "Mappools"],
    [`${base}/results`, "Results"],
    [`${base}/bracket`, "Bracket"],
    [`${base}/participants`, "Participants"],
    [`${base}/teams`, "Teams"],
    [`/players?edition=${slug}`, "Players"],
    ...(liveDraft ? [[`${base}/draft`, "Live draft"]] : []),
  ];
  return (
    <nav ref={navigation} aria-label="Tournament navigation">
      {links.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={
            (
              href === base
                ? pathname === href
                : pathname === href || pathname.startsWith(`${href}/`)
            )
              ? "page"
              : undefined
          }
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
