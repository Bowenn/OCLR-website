import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { ownTeam } from "@/lib/teams";
import { PageHeading, EmptyState } from "@/components/ui";
export const metadata = {
  title: "My captain team",
  robots: { index: false, follow: false },
};
export default async function MyTeam({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { edition } = await params;
  const team = await ownTeam(user.osuId, edition);
  return (
    <>
      <PageHeading eyebrow="CAPTAIN WORKSPACE" title="My team">
        Your assigned edition team. Roster changes are made through the draft.
      </PageHeading>
      {team ? (
        <section className="panel">
          <h2>{team.name}</h2>
          <p className="muted">
            {team.finalizedAt ? "Finalized roster" : "Draft roster in progress"}
          </p>
          <ul>
            {team.members.map((m) => (
              <li key={m.osuId}>
                <a
                  className="text-link"
                  href={`https://osu.ppy.sh/users/${m.osuId}`}
                >
                  {m.username}
                </a>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <EmptyState title="No captain team assigned">
          Captain appointments and team configuration are managed by staff for
          each edition.
        </EmptyState>
      )}
    </>
  );
}
