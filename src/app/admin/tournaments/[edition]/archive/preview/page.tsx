import { notFound } from "next/navigation";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { tournamentForAdmin } from "@/lib/tournaments";
import {
  HistoricalArchiveView,
  type ArchiveSection,
} from "@/components/historical-archive";
const sections = new Set<ArchiveSection>([
  "overview",
  "teams",
  "team",
  "players",
  "player",
  "schedule",
  "results",
  "match",
  "mappools",
  "pool",
  "bracket",
  "draft",
  "rules",
  "awards",
]);
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ section?: string; id?: string }>;
}) {
  return authorizedPage(async () => {
    const data = await tournamentForAdmin(
      await requireStaff(),
      (await params).edition,
    );
    if (!data.edition.archive) notFound();
    const query = await searchParams;
    let section = (query.section ?? "overview") as ArchiveSection;
    if (query.id)
      section =
        (
          {
            teams: "team",
            players: "player",
            matches: "match",
            mappools: "pool",
          } as Record<string, ArchiveSection>
        )[section] ?? section;
    if (!sections.has(section)) notFound();
    return (
      <HistoricalArchiveView
        edition={data.edition}
        archive={data.edition.archive}
        section={section}
        id={query.id}
        preview
      />
    );
  });
}
