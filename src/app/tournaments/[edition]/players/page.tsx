import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { publicPlayers } from "@/lib/players";
import { getPublicEdition } from "@/lib/content";
import { notFound } from "next/navigation";
import { HttpError } from "@/lib/http";
import { Action, PageHeading } from "@/components/ui";
import styles from "./players.module.css";
import { PublicPlayerIdentity } from "@/components/public-player-identity";
import { after } from "next/server";
import {
  cachedDirectoryStatistics,
  refreshDirectoryStatistics,
  type DirectoryStatistics,
} from "@/lib/osu-profiles";
import { formatDate } from "@/lib/editions";
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
      <div className="directory-page edition-players">
        <PageHeading eyebrow={tr("PUBLIC DIRECTORY")} title={tr("Players")}>
          {error.message}
        </PageHeading>
        <Action href={base}>{tr("Clear filters")}</Action>
      </div>
    );
  }
  const { rows, total, filters } = result;
  const { statistics, refreshIds } = await cachedDirectoryStatistics(
    rows.map((p) => p.osuId),
  ).catch(() => ({
    statistics: new Map<number, DirectoryStatistics>(),
    refreshIds: [] as number[],
  }));
  if (refreshIds.length)
    after(async () => {
      try {
        // A publication or registration decision may change after rendering.
        const current = await publicPlayers(filters);
        const visible = new Set(current.rows.map((p) => p.osuId));
        await refreshDirectoryStatistics(
          refreshIds.filter((id) => visible.has(id)),
        );
      } catch {
        // Stats refresh must never prevent an otherwise usable public directory.
      }
    });
  const number = new Intl.NumberFormat(tr.locale, { maximumFractionDigits: 2 });
  const query = new URLSearchParams({ q: filters.q });
  return (
    <div className="directory-page edition-players">
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
        <ul className={styles.grid}>
          {rows.map((p) => {
            const stats = statistics.get(p.osuId);
            const updated = stats
              ? tr("Updated {value0}{value1}", {
                  value0: formatDate(stats.fetchedAt, "UTC", tr.locale),
                  value1: "",
                })
              : tr("osu! statistics are temporarily unavailable.");
            return (
              <li className={styles.card} key={p.osuId}>
                <div className={styles.identity}>
                  <PublicPlayerIdentity osuId={p.osuId} username={p.username} />
                  <Link
                    className={`context-link ${styles.profile}`}
                    href={`/players/${p.osuId}?edition=${edition}`}
                    prefetch={false}
                    aria-label={tr("OCLR profile")}
                    title={tr("OCLR profile")}
                  >
                    <span aria-hidden="true">↗</span>
                  </Link>
                </div>
                <div className={styles.stats} title={updated}>
                  <div className={styles.mode}>
                    <span>{"osu!standard"}</span>
                    {stats?.stale && <span>{tr("SAVED SNAPSHOT")}</span>}
                    {stats && (
                      <time className="sr-only" dateTime={stats.fetchedAt}>
                        {updated}
                      </time>
                    )}
                  </div>
                  <dl>
                    <div>
                      <dt>{tr("Global rank")}</dt>
                      <dd>
                        {stats?.globalRank != null && stats.globalRank > 0
                          ? `#${number.format(stats.globalRank)}`
                          : "—"}
                      </dd>
                    </div>
                    <div>
                      <dt>PP</dt>
                      <dd>
                        {stats?.pp != null ? number.format(stats.pp) : "—"}
                      </dd>
                    </div>
                  </dl>
                </div>
                <div className={styles.footer}>
                  <span className="badge">
                    {p.participation === "finalized_roster"
                      ? tr("Finalized roster")
                      : p.captain
                        ? tr("Captain")
                        : tr("Accepted player")}
                  </span>
                  {p.captain && p.participation === "finalized_roster" && (
                    <span className="badge">{tr("Captain")}</span>
                  )}
                  {p.team ? (
                    <Link
                      className="context-link"
                      href={`/tournaments/${edition}/teams/${p.team.id}`}
                    >
                      {p.team.name}
                    </Link>
                  ) : (
                    <span className="muted" title={tr("Team")}>
                      {tr("Not announced")}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="directory-empty" role="status">
          <p className="muted">
            {filters.q
              ? tr("No matching players")
              : tr("No accepted players yet")}
          </p>
          {filters.q && (
            <Link className="context-link" href={base}>
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
