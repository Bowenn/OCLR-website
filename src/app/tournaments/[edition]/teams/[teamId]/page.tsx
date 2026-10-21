import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { publishedTeams } from "@/lib/teams";
import { PageHeading, EmptyState } from "@/components/ui";
import { PublicPlayerIdentity } from "@/components/public-player-identity";
export default async function Team({
  params,
}: {
  params: Promise<{ edition: string; teamId: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition, teamId } = await params;
  const team = (await publishedTeams(edition)).find((t) => t.id === teamId);
  if (!team) notFound();
  return (
    <>
      <Link className="context-link" href={`/tournaments/${edition}/teams`}>
        {tr("All teams")}
      </Link>
      <PageHeading eyebrow={tr("PUBLISHED TEAM")} title={team.name}>
        {tr("Captain: ")}
        {team.captainName}
      </PageHeading>
      {team.members ? (
        <section aria-labelledby="roster-heading">
          <h2 id="roster-heading">{tr("Published roster")}</h2>
          <ul className="public-roster-grid">
            {team.members.map((m) => (
              <li className="panel" key={m.osuId}>
                <PublicPlayerIdentity {...m} edition={edition} />
                {m.osuId === team.captainId && (
                  <span className="badge">{tr("Captain")}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState title={tr("Roster awaiting publication")}>
          {tr(
            "Roster details remain private until finalized and approved for release.",
          )}
        </EmptyState>
      )}
    </>
  );
}
