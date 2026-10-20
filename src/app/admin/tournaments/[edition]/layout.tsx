import { authorizedPage } from "@/lib/auth/page";
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/auth/staff";
import { tournamentList } from "@/lib/tournaments";
export default async function TournamentLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const { edition } = await params;
    const data = await tournamentList(await requireStaff());
    if (!data.rows.some((row) => row.slug === edition)) notFound();
    return children;
  });
}
