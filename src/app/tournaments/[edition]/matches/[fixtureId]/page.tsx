import Link from "next/link";
import { notFound } from "next/navigation";
import { publicFixture } from "@/lib/public-competition";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export const metadata = { title: "Match details" };
export default async function MatchPage({
  params,
}: {
  params: Promise<{ edition: string; fixtureId: string }>;
}) {
  const { edition: slug, fixtureId } = await params;
  const f = await publicFixture(slug, fixtureId);
  if (!f) notFound();
  const result = f.result;
  const teamName = (id: string | null) =>
    id === f.home.team?.id
      ? f.home.label
      : id === f.away.team?.id
        ? f.away.label
        : "Unresolved";
  return (
    <>
      <Link className="text-link" href={`/tournaments/${slug}/results`}>
        ← All matches
      </Link>
      <PageHeading
        eyebrow={`${f.stage === "group" ? "GROUP STAGE" : "KNOCKOUT STAGE"} / ${f.roundName}`}
        title={f.label}
      >
        {f.status === "cancelled"
          ? "Cancelled — no winner assumed"
          : result
            ? "Approved and published result"
            : "Awaiting published result"}
      </PageHeading>
      <section className="panel stack">
        <div className="match-versus">
          <span>
            {f.home.team ? (
              <Link
                className="text-link"
                href={`/tournaments/${slug}/teams/${f.home.team.id}`}
              >
                {f.home.label}
              </Link>
            ) : (
              f.home.label
            )}
          </span>
          <strong>
            {result ? `${result.homeWins} : ${result.awayWins}` : "vs"}
          </strong>
          <span>
            {f.away.team ? (
              <Link
                className="text-link"
                href={`/tournaments/${slug}/teams/${f.away.team.id}`}
              >
                {f.away.label}
              </Link>
            ) : (
              f.away.label
            )}
          </span>
        </div>
        <p>
          {f.scheduledAt
            ? formatDate(f.scheduledAt, f.timeZone)
            : "Match time TBA"}{" "}
          · {f.timeZone}
        </p>
        {f.pool && (
          <Link
            className="text-link"
            href={`/tournaments/${slug}/mappools/${f.pool.id}`}
          >
            Released mappool: {f.pool.name} ↗
          </Link>
        )}
        {!f.confirmed && (
          <p className="notice">
            This fixture awaits confirmation against published progression. No
            score or multiplayer source is shown until the teams agree with the
            approved record.
          </p>
        )}
        {result ? (
          <>
            <p>
              {result.draw
                ? "Approved draw"
                : `Winner: ${teamName(result.winnerTeamId)}`}
            </p>
            {result.publicNote && <p className="notice">{result.publicNote}</p>}
            <a
              className="text-link"
              href={result.mpUrl}
              target="_blank"
              rel="noreferrer"
            >
              osu! multiplayer source #{result.mpId} ↗
            </a>
            <p className="muted small">
              Published · Updated {formatDate(result.updatedAt, f.timeZone)}
            </p>
          </>
        ) : (
          <p className="muted">
            Scores and source links appear after separate review, approval and
            publication.
          </p>
        )}
      </section>
      {result && (
        <section className="section-space stack">
          <h2>Played maps</h2>
          {result.games.map((g, i) => (
            <article className="panel" key={g.gameId}>
              <p className="eyebrow">
                MAP {i + 1} · {g.mods.join(" / ") || "NM"} · {g.scoringType}
              </p>
              <h3>
                {g.beatmap?.artist ? `${g.beatmap.artist} — ` : ""}
                {g.beatmap?.title ?? "Beatmap unavailable"}
              </h3>
              <p className="muted">{g.beatmap?.difficulty}</p>
              {g.beatmapId && (
                <a
                  className="text-link"
                  href={`https://osu.ppy.sh/beatmaps/${g.beatmapId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Beatmap {g.beatmapId} ↗
                </a>
              )}
              <p>
                {f.home.label}: {g.homeScore.toLocaleString("en")} ·{" "}
                {f.away.label}: {g.awayScore.toLocaleString("en")}
              </p>
              <p>
                {g.tied
                  ? "Approved tied map"
                  : `Map winner: ${teamName(g.winnerTeamId)}`}
              </p>
            </article>
          ))}
        </section>
      )}
    </>
  );
}
