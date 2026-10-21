import { getAppTranslations } from "@/i18n/server";
import { StaffNavigation } from "@/components/staff-navigation";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { staffAccess, permits } from "@/lib/auth/staff";
import { tournamentList } from "@/lib/tournaments";
import { globalNavigation } from "@/lib/admin-navigation";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Administration"),
    robots: { index: false, follow: false },
  };
}

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const grants = await staffAccess(user);
  if (!grants.length) notFound();
  const data = await tournamentList(user);
  const globalLinks = globalNavigation.filter(
    (link) =>
      !link.capability ||
      grants.some((grant) =>
        permits([grant], link.capability!, grant.editionSlug ?? undefined),
      ),
  );
  return (
    <StaffNavigation
      globalLinks={globalLinks}
      editions={data.rows.map(({ slug, name, status, published, links }) => ({
        slug,
        name,
        status,
        published,
        links,
      }))}
      username={user.username}
    >
      {children}
    </StaffNavigation>
  );
}
