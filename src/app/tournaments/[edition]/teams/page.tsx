import Link from "next/link";
import { publishedTeams } from "@/lib/teams";
import { PageHeading, EmptyState } from "@/components/ui";
export const metadata = { title: "Published teams" };
export default async function Teams({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const teams = await publishedTeams(edition);
  return (
    <>
      <PageHeading eyebrow="TEAM COMPETITION" title="Teams">
        Approved team identities and published, finalized rosters.
      </PageHeading>
      {teams.length ? (
        <div className="stack">
          {teams.map((t) => (
            <article className="panel" key={t.id}>
              <h2>
                <Link href={`/tournaments/${edition}/teams/${t.id}`}>
                  {t.name}
                </Link>
              </h2>
              <p className="muted">
                {t.members
                  ? `${t.members.length} published roster members`
                  : "Roster awaiting publication"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState title="No teams published">
          Teams will appear after organizer approval. Individual applications
          remain private.
        </EmptyState>
      )}
    </>
  );
}
