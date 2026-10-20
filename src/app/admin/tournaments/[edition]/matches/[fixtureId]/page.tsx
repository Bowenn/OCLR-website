import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
import { fixtureForReview } from "@/lib/fixtures";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export const metadata = { title: "Fixture review" };
export default async function FixturePage({
  params,
}: {
  params: Promise<{ edition: string; fixtureId: string }>;
}) {
  const actor = await requireUser();
  const { edition, fixtureId } = await params;
  const data = await fixtureForReview(actor, edition, fixtureId);
  return (
    <>
      <Link
        className="text-link"
        href={`/admin/tournaments/${edition}/matches`}
      >
        ← Fixtures
      </Link>
      <PageHeading
        eyebrow={`${data.round.stage === "group" ? "GROUP" : "KNOCKOUT"} STAGE / ${data.round.name}`}
        title={data.fixture.label}
      >
        {data.teams.map((t) => t.name).join(" vs ")} ·{" "}
        {data.fixture.status.replaceAll("_", " ")}
      </PageHeading>
      <div className="panel">
        <p>
          {data.fixture.scheduledAt
            ? formatDate(data.fixture.scheduledAt, data.fixture.timeZone)
            : "Match time TBA"}{" "}
          · {data.fixture.timeZone}
        </p>
        <p>
          {data.pool
            ? `Associated pool: ${data.pool.name}`
            : "No mappool associated"}
        </p>
        <p className="notice">
          No MP report submitted. Public scores require an explicitly reviewed,
          approved and published result.
        </p>
        {!data.round.scoringRules && (
          <p className="notice">
            Scoring rules await organizer configuration. No winner will be
            assumed.
          </p>
        )}
      </div>
      <section className="section-space">
        <h2>Official rosters</h2>
        <div className="stack">
          {data.teams.map((t) => (
            <article className="panel" key={t.id}>
              <h3>{t.name}</h3>
              <ul>
                {t.members.map((m) => (
                  <li key={m.osuId}>
                    {m.username} · osu! ID {m.osuId}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
