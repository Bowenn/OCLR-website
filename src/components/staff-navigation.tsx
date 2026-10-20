"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
export function StaffNavigation({
  canManageStaff,
  editions,
}: {
  canManageStaff: boolean;
  editions: {
    slug: string;
    name: string;
    links: { path: string; label: string }[];
  }[];
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Staff navigation">
      <Link href="/admin">Operations</Link>
      {canManageStaff && <Link href="/admin/staff">Staff assignments</Link>}
      <Link href="/dashboard">Player dashboard</Link>
      {editions.map((e) => (
        <details
          className="staff-edition-nav"
          key={e.slug}
          open={pathname.startsWith(`/admin/tournaments/${e.slug}/`)}
        >
          <summary>{e.name}</summary>
          <div>
            {e.links.map((link) => (
              <Link
                key={link.path}
                href={`/admin/tournaments/${e.slug}/${link.path}`}
                aria-current={
                  pathname.startsWith(
                    `/admin/tournaments/${e.slug}/${link.path}`,
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
