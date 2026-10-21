import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { publicCaptains } from "@/lib/captains";
import { publishedTeams } from "@/lib/teams";
import { publicDraft } from "@/lib/draft";
import { EmptyState, PageHeading } from "@/components/ui";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Captains & rosters") };
}

export default async function Participants({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition } = await params;
  const [captains, teams, draft] = await Promise.all([
    publicCaptains(edition),
    publishedTeams(edition),
    publicDraft(edition),
  ]);
  return (
    <>
      <PageHeading
        eyebrow={tr("THE COMMUNITY")}
        title={tr("Captains & rosters")}
      >
        {tr("Approved captains and finalized team rosters.")}
      </PageHeading>
      <p className="notice small">
        {tr("Accepted players appear in the")}{" "}
        <Link href={`/tournaments/${edition}/players`} className="text-link">
          {tr("Players directory")}
        </Link>
        {tr(
          ". Captain appointments and team rosters appear here only when released. Application answers and staff review notes remain private; see the",
        )}{" "}
        <Link href="/privacy" className="text-link">
          {tr("privacy notice")}
        </Link>{" "}
        {tr("for access, correction and removal requests.")}
      </p>
      {captains.length || teams.length ? (
        <>
          {captains.length > 0 && (
            <section className="section-space">
              <h2>{tr("Published captains")}</h2>
              <ol className="schedule-list">
                {captains.map((c, i) => (
                  <li key={c.osuId}>
                    <span className="eyebrow">{i + 1}</span>
                    <div>
                      <h3>
                        <a
                          className="text-link"
                          href={`https://osu.ppy.sh/users/${c.osuId}`}
                        >
                          {c.username} ↗
                        </a>
                      </h3>
                      <p className="small muted">
                        {tr("osu! ID ")}
                        {c.osuId}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {teams.length > 0 && (
            <section className="section-space">
              <h2>{tr("Teams & finalized rosters")}</h2>
              <div className="stack">
                {teams.map((t) => (
                  <article className="panel" key={t.id}>
                    <h3>
                      <Link href={`/tournaments/${edition}/teams/${t.id}`}>
                        {t.name}
                      </Link>
                    </h3>
                    {t.members ? (
                      <ul className="public-pool">
                        {t.members.map((m) => (
                          <li key={m.osuId}>
                            <a
                              href={`https://osu.ppy.sh/users/${m.osuId}`}
                              className="text-link"
                            >
                              {m.username}
                            </a>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="muted small">
                        {tr("Roster awaiting finalization and publication.")}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      ) : (
        <EmptyState title={tr("No participants published")}>
          {tr(
            "Approved captains and team identities will appear here when organizers release them.",
          )}
        </EmptyState>
      )}
      {draft && (
        <p className="spaced">
          <Link
            className="button secondary"
            href={`/tournaments/${edition}/draft`}
          >
            {tr("View the published draft")}
          </Link>
        </p>
      )}
    </>
  );
}
