import Link from "next/link";
import { publicPlayers } from "@/lib/players";
import { getPublicEditions } from "@/lib/content";
import { HttpError } from "@/lib/http";
import { Action, EmptyState, PageHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
export const metadata = {
  title: "Published players",
  description:
    "Browse OCLR's published captains, participants and finalized team rosters.",
};
export default async function Players({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let result;
  try {
    result = await publicPlayers(await searchParams);
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 400) throw error;
    return (
      <div className="container page">
        <PageHeading eyebrow="PUBLIC DIRECTORY" title="Players">
          {error.message}
        </PageHeading>
        <Action href="/players">Clear filters</Action>
      </div>
    );
  }
  const { rows, total, filters } = result;
  const query = new URLSearchParams({ q: filters.q, edition: filters.edition });
  return (
    <div className="container page">
      <PageHeading eyebrow="INDIVIDUAL PLAYERS. ONE COMMUNITY." title="Players">
        Meet the published captains and players representing OCLR. Browse the
        directory without signing in.
      </PageHeading>
      <div className="actions">
        <Action href="/dashboard" secondary>
          My private dashboard →
        </Action>
        <Action href="/tournaments" secondary>
          Browse tournaments
        </Action>
      </div>
      <p className="notice spaced">
        Applications stay private. Acceptance alone does not publish a player:
        only approved captain identities and finalized, published team rosters
        appear here.
      </p>
      <form action="/players" method="get" className="filters">
        <label className="field">
          <span>Search published player or osu! ID</span>
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Username or stable osu! ID"
          />
        </label>
        <label className="field">
          <span>Tournament edition</span>
          <select name="edition" defaultValue={filters.edition}>
            <option value="">All published editions</option>
            {getPublicEditions().map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <button type="submit">Search</button>
      </form>
      <p className="muted small" role="status">
        {total} matching public player {total === 1 ? "entry" : "entries"}
      </p>
      {rows.length ? (
        <ul className="player-directory">
          {rows.map((p) => (
            <li className="panel" key={`${p.editionSlug}-${p.osuId}`}>
              <div className="directory-identity">
                <Avatar osuId={p.osuId} username={p.username} />
                <div>
                  <h2>
                    <a
                      className="text-link"
                      href={`https://osu.ppy.sh/users/${p.osuId}`}
                    >
                      {p.username} ↗
                    </a>
                  </h2>
                  <p className="small muted">
                    osu! ID {p.osuId}
                    {p.captain && (
                      <>
                        {" "}
                        · <span className="badge">Captain</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <dl className="directory-details">
                <div>
                  <dt>Edition</dt>
                  <dd>
                    <Link
                      className="text-link"
                      href={`/tournaments/${p.editionSlug}`}
                    >
                      {p.editionName}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Team</dt>
                  <dd>
                    {p.team ? (
                      <Link
                        className="text-link"
                        href={`/tournaments/${p.editionSlug}/teams/${p.team.id}`}
                      >
                        {p.team.name} ↗
                      </Link>
                    ) : (
                      "Team identity awaiting publication"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Public participation</dt>
                  <dd>
                    {p.participation === "finalized_roster"
                      ? "Finalized roster"
                      : "Appointed captain"}
                  </dd>
                </div>
              </dl>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          title={
            filters.q || filters.edition
              ? "No matching published players"
              : "No players published yet"
          }
        >
          Approved captains and finalized rosters will appear after organizers
          release them. Try another filter or browse the tournament pages.
        </EmptyState>
      )}
      <nav className="actions spaced" aria-label="Player directory pages">
        {filters.page > 1 && (
          <Link
            className="button secondary"
            href={`/players?${query}&page=${filters.page - 1}`}
          >
            ← Previous
          </Link>
        )}
        {filters.page * 24 < total && (
          <Link
            className="button secondary"
            href={`/players?${query}&page=${filters.page + 1}`}
          >
            Next →
          </Link>
        )}
      </nav>
    </div>
  );
}
