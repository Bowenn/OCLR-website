import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { getEditions } from "@/lib/content";
import { staffAccess, permits } from "@/lib/auth/staff";
export const metadata = {
  title: "Staff workspace",
  robots: { index: false, follow: false },
};
export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const grants = await staffAccess(user);
  if (!grants.length) notFound();
  const can = (cap: Parameters<typeof permits>[1], slug?: string) =>
    permits(grants, cap, slug);
  return (
    <div className="container page workspace">
      <aside className="sidebar">
        <p className="eyebrow">STAFF WORKSPACE</p>
        <h2>OCLR operations</h2>
        <nav aria-label="Staff navigation">
          <Link href="/admin">Operations</Link>
          {grants.some((g) => g.role === "admin") && (
            <Link href="/admin/staff">Staff assignments</Link>
          )}
          <Link href="/dashboard">Player dashboard</Link>
          {getEditions()
            .filter((e) => can("manage_mappools", e.slug))
            .map((e) => (
              <Link
                key={`maps-${e.slug}`}
                href={`/admin/tournaments/${e.slug}/mappools`}
              >
                {e.name}: Mappools
              </Link>
            ))}
          {getEditions()
            .filter((e) => can("manage_captains", e.slug))
            .map((e) => (
              <Link key={e.slug} href={`/admin/tournaments/${e.slug}/captains`}>
                {e.name}: Captains
              </Link>
            ))}
          {getEditions()
            .filter((e) => can("manage_teams", e.slug))
            .map((e) => (
              <Link
                key={`teams-${e.slug}`}
                href={`/admin/tournaments/${e.slug}/teams`}
              >
                {e.name}: Teams
              </Link>
            ))}
          {getEditions()
            .filter((e) => can("manage_draft", e.slug))
            .map((e) => (
              <Link
                key={`draft-${e.slug}`}
                href={`/admin/tournaments/${e.slug}/draft`}
              >
                {e.name}: Draft
              </Link>
            ))}
        </nav>
        <p className="muted small spaced">Signed in as {user.username}</p>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
