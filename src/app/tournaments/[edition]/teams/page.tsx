import { getAppTranslations } from "@/i18n/server";
import { publishedTeams } from "@/lib/teams";
import { publicCompetition } from "@/lib/public-competition";
import { PageHeading, EmptyState } from "@/components/ui";
import { PublicTeams } from "@/components/public-teams";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Published teams") };
}

export default async function Teams({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition } = await params;
  const [teams, competition] = await Promise.all([
    publishedTeams(edition),
    publicCompetition(edition),
  ]);
  return (
    <>
      <PageHeading title={tr("Teams")} />
      {teams.length ? (
        <PublicTeams
          teams={teams}
          groups={competition?.groups ?? []}
          slug={edition}
        />
      ) : (
        <EmptyState title={tr("No teams published")}>
          {tr("Approved team identities will appear here when released.")}
        </EmptyState>
      )}
    </>
  );
}
