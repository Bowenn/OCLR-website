import { publishedTeams } from "@/lib/teams";
import { publicCompetition } from "@/lib/public-competition";
import { PageHeading, EmptyState } from "@/components/ui";
import { PublicTeams } from "@/components/public-teams";
export const metadata = { title: "Published teams" };
export default async function Teams({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const [teams, competition] = await Promise.all([
    publishedTeams(edition),
    publicCompetition(edition),
  ]);
  return (
    <>
      <PageHeading eyebrow="TEAM COMPETITION" title="Teams">
        Published team identities and finalized rosters.
      </PageHeading>
      {teams.length ? (
        <PublicTeams
          teams={teams}
          groups={competition?.groups ?? []}
          slug={edition}
        />
      ) : (
        <EmptyState title="No teams published">
          Approved team identities will appear here when released.
        </EmptyState>
      )}
    </>
  );
}
