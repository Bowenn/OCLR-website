import { notFound } from "next/navigation";
import { publishedTeams } from "@/lib/teams";
import { PageHeading, EmptyState } from "@/components/ui";
export default async function Team({
  params,
}: {
  params: Promise<{ edition: string; teamId: string }>;
}) {
  const { edition, teamId } = await params;
  const team = (await publishedTeams(edition)).find((t) => t.id === teamId);
  if (!team) notFound();
  return (
    <>
      <PageHeading eyebrow="PUBLISHED TEAM" title={team.name}>
        Captain osu! ID {team.captainId}
      </PageHeading>
      {team.members ? (
        <ul className="schedule-list">
          {team.members.map((m) => (
            <li key={m.osuId}>
              <a
                href={`https://osu.ppy.sh/users/${m.osuId}`}
                className="text-link"
              >
                {m.username} ↗
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState title="Roster awaiting publication">
          Roster details remain private until finalized and approved for
          release.
        </EmptyState>
      )}
    </>
  );
}
