"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function StaffNavigation({
  canManageStaff,
  canLookupProfiles,
  editions,
}: {
  canManageStaff: boolean;
  canLookupProfiles: boolean;
  editions: {
    slug: string;
    name: string;
    links: { path: string; label: string }[];
  }[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff navigation">
      <Link href="/admin/tournaments">Tournaments</Link>
      <Link href="/admin">Registration review</Link>
      {canLookupProfiles && (
        <Link href="/admin/profiles">osu! profile lookup</Link>
      )}
      {canManageStaff && <Link href="/admin/staff">Staff assignments</Link>}
      <Link href="/dashboard">Player dashboard</Link>
      {editions.map((e) => (
        <details
          className="staff-edition-nav"
          key={e.slug}
          open={
            pathname === `/admin/tournaments/${e.slug}` ||
            pathname.startsWith(`/admin/tournaments/${e.slug}/`)
          }
        >
          <summary>{e.name}</summary>
          <div>
            {e.links.map((link) => (
              <Link
                key={link.path}
                href={`/admin/tournaments/${e.slug}${link.path ? `/${link.path}` : ""}`}
                aria-current={
                  (
                    link.path
                      ? pathname.startsWith(
                          `/admin/tournaments/${e.slug}/${link.path}`,
                        )
                      : pathname === `/admin/tournaments/${e.slug}`
                  )
                    ? "page"
                    : undefined
                }
              >
                {link.label}
              </Link>
            ))}
          </div>
        </details>
      ))}
    </nav>
  );
}
