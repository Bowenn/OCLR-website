import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { isStaff } from "@/lib/auth/staff";
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
  if (!isStaff(user)) notFound();
  return (
    <div className="container page workspace">
      <aside className="sidebar">
        <p className="eyebrow">STAFF WORKSPACE</p>
        <h2>OCLR operations</h2>
        <nav aria-label="Staff navigation">
          <Link href="/admin">Registrations</Link>
          <Link href="/dashboard">Player dashboard</Link>
        </nav>
        <p className="muted small spaced">Signed in as {user.username}</p>
      </aside>
      <div className="workspace-main">{children}</div>
    </div>
  );
}
