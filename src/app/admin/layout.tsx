import { StaffNavigation } from "@/components/staff-navigation";
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
  const editions = getEditions()
    .map((e) => ({
      slug: e.slug,
      name: e.name,
      links: [
        ...(can("manage_fixtures", e.slug) || can("record_results", e.slug)
          ? [{ path: "matches", label: "Fixtures & results" }]
          : []),
        ...(can("manage_mappools", e.slug)
          ? [{ path: "mappools", label: "Mappools" }]
          : []),
        ...(can("manage_captains", e.slug)
          ? [{ path: "captains", label: "Captains" }]
          : []),
        ...(can("manage_teams", e.slug)
          ? [{ path: "teams", label: "Teams" }]
          : []),
        ...(can("manage_draft", e.slug)
          ? [{ path: "draft", label: "Draft" }]
          : []),
      ],
    }))
    .filter((e) => e.links.length);
  return (
    <div className="container page workspace">
      <aside className="sidebar">
        <p className="eyebrow">STAFF WORKSPACE</p>
        <h2>OCLR operations</h2>
        <StaffNavigation
          canLookupProfiles={grants.some((g) => g.role === "admin")}
          canManageStaff={grants.some((g) => g.role === "admin")}
          editions={editions}
        />
        <p className="muted small spaced">Signed in as {user.username}</p>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
