import { getAppTranslations } from "@/i18n/server";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { ownTeam } from "@/lib/teams";
import { PageHeading, EmptyState } from "@/components/ui";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("My captain team"),
    robots: { index: false, follow: false },
  };
}

export default async function MyTeam({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const user = await currentUser();
  if (!user) redirect("/login");
  const { edition } = await params;
  const team = await ownTeam(user.osuId, edition);
  return (
    <>
      <PageHeading eyebrow={tr("CAPTAIN WORKSPACE")} title={tr("My team")}>
        {tr(
          "Your assigned edition team. Roster changes are made through the draft.",
        )}
      </PageHeading>
      {team ? (
        <section className="panel">
          <h2>{team.name}</h2>
          <p className="muted">
            {team.finalizedAt
              ? tr("Finalized roster")
              : tr("Draft roster in progress")}
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
        <EmptyState title={tr("No captain team assigned")}>
          {tr(
            "Captain appointments and team configuration are managed by staff for each edition.",
          )}
        </EmptyState>
      )}
    </>
  );
}
