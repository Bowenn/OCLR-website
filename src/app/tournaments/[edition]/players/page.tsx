import Link from "next/link";
import { publicPlayers } from "@/lib/players";
import { getPublicEdition } from "@/lib/content";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/http";
import { Action, PageHeading } from "@/components/ui";
import { PublicPlayerIdentity } from "@/components/public-player-identity";
export const metadata = {
  title: "Players",
  description: "Accepted players and announced teams for this OCLR tournament.",
};
export default async function Players({
  searchParams,
  params,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { edition } = await params;
  if (!(await getPublicEdition(edition))) notFound();
  const base = `/tournaments/${edition}/players`;
  let result;
  try {
    const query = await searchParams;
    if (Object.keys(query).some((key) => !["q", "page"].includes(key)))
      throw new HttpError(400, "Choose a valid player search and page.");
    result = await publicPlayers({ ...query, edition });
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 400) throw error;
    return (
      <div className="directory-page">
        <PageHeading eyebrow="PUBLIC DIRECTORY" title="Players">
          {error.message}
        </PageHeading>
        <Action href={base}>Clear filters</Action>
      </div>
    );
  }
  const { rows, total, filters } = result;
  const query = new URLSearchParams({ q: filters.q });
  return (
    <div className="directory-page">
      <PageHeading title="Players" />
      <form action={base} method="get" className="filters">
        <label className="field">
          <span>Search players</span>
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Username or osu! ID"
          />
        </label>
        <button type="submit">Search</button>
      </form>
      {total > 0 && (
        <p className="muted small" role="status">
          {total} player {total === 1 ? "entry" : "entries"}
        </p>
      )}
      {rows.length ? (
        <ul className="player-directory">
          {rows.map((p) => (
            <li className="panel" key={`${p.editionSlug}-${p.osuId}`}>
              <PublicPlayerIdentity osuId={p.osuId} username={p.username} />
              {p.captain && <span className="badge">Captain</span>}
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
                        {p.team.name}
                      </Link>
                    ) : (
                      "Not announced"
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {p.participation === "finalized_roster"
                      ? "Finalized roster"
                      : p.captain
                        ? "Appointed captain"
                        : "Accepted player"}
                  </dd>
                </div>
              </dl>
              <Link
                className="text-link"
                href={`/players/${p.osuId}?edition=${edition}`}
                prefetch={false}
              >
                Player profile & statistics
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="directory-empty" role="status">
          <p className="muted">
            {filters.q ? "No matching players" : "No accepted players yet"}
          </p>
          {filters.q && (
            <Link className="text-link" href={base}>
              Clear filters
            </Link>
          )}
        </div>
      )}
      <nav className="actions spaced" aria-label="Player directory pages">
        {filters.page > 1 && (
          <Link
            className="button secondary"
            href={`${base}?${query}&page=${filters.page - 1}`}
          >
            ← Previous
          </Link>
        )}
        {filters.page * 24 < total && (
          <Link
            className="button secondary"
            href={`${base}?${query}&page=${filters.page + 1}`}
          >
            Next →
          </Link>
        )}
      </nav>
    </div>
  );
}
