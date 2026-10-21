import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { publicPlayers } from "@/lib/players";
import { getPublicEdition } from "@/lib/content";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/http";
import { Action, PageHeading } from "@/components/ui";
import { PublicPlayerIdentity } from "@/components/public-player-identity";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return {
    title: tr("Players"),
    description: tr(
      "Accepted players and announced teams for this OCLR tournament.",
    ),
  };
}

export default async function Players({
  searchParams,
  params,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const tr = await getAppTranslations();

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
        <PageHeading eyebrow={tr("PUBLIC DIRECTORY")} title={tr("Players")}>
          {error.message}
        </PageHeading>
        <Action href={base}>{tr("Clear filters")}</Action>
      </div>
    );
  }
  const { rows, total, filters } = result;
  const query = new URLSearchParams({ q: filters.q });
  return (
    <div className="directory-page">
      <PageHeading title={tr("Players")} />
      <form action={base} method="get" className="filters">
        <label className="field">
          <span>{tr("Search players")}</span>
          <input
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder={tr("Username or osu! ID")}
          />
        </label>
        <button type="submit">{tr("Search")}</button>
      </form>
      {total > 0 && (
        <p className="muted small" role="status">
          {total} {tr(" player ")}
          {total === 1 ? tr("entry") : tr("entries")}
        </p>
      )}
      {rows.length ? (
        <ul className="player-directory">
          {rows.map((p) => (
            <li className="panel" key={`${p.editionSlug}-${p.osuId}`}>
              <PublicPlayerIdentity osuId={p.osuId} username={p.username} />
              {p.captain && <span className="badge">{tr("Captain")}</span>}
              <dl className="directory-details">
                <div>
                  <dt>{tr("Edition")}</dt>
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
                  <dt>{tr("Team")}</dt>
                  <dd>
                    {p.team ? (
                      <Link
                        className="text-link"
                        href={`/tournaments/${p.editionSlug}/teams/${p.team.id}`}
                      >
                        {p.team.name}
                      </Link>
                    ) : (
                      tr("Not announced")
                    )}
                  </dd>
                </div>
                <div>
                  <dt>{tr("Status")}</dt>
                  <dd>
                    {p.participation === "finalized_roster"
                      ? tr("Finalized roster")
                      : p.captain
                        ? tr("Appointed captain")
                        : tr("Accepted player")}
                  </dd>
                </div>
              </dl>
              <Link
                className="text-link"
                href={`/players/${p.osuId}?edition=${edition}`}
                prefetch={false}
              >
                {tr("Player profile & statistics")}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="directory-empty" role="status">
          <p className="muted">
            {filters.q
              ? tr("No matching players")
              : tr("No accepted players yet")}
          </p>
          {filters.q && (
            <Link className="text-link" href={base}>
              {tr("Clear filters")}
            </Link>
          )}
        </div>
      )}
      <nav className="actions spaced" aria-label={tr("Player directory pages")}>
        {filters.page > 1 && (
          <Link
            className="button secondary"
            href={`${base}?${query}&page=${filters.page - 1}`}
          >
            {tr("← Previous")}
          </Link>
        )}
        {filters.page * 24 < total && (
          <Link
            className="button secondary"
            href={`${base}?${query}&page=${filters.page + 1}`}
          >
            {tr("Next →")}
          </Link>
        )}
      </nav>
    </div>
  );
}
