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
import { z } from "zod";
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
  let view: "cards" | "list" = "cards";
  try {
    const query = await searchParams;
    const selected = z
      .enum(["cards", "list"])
      .default("cards")
      .safeParse(query.view);
    if (
      !selected.success ||
      Object.keys(query).some((key) => !["q", "page", "view"].includes(key))
    )
      throw new HttpError(400, "Choose a valid player search and page.");
    view = selected.data;
    result = await publicPlayers({ q: query.q, page: query.page, edition });
  } catch (error) {
    if (!(error instanceof HttpError) || error.status !== 400) throw error;
    return (
      <div className="directory-page edition-players">
        <PageHeading eyebrow={tr("PUBLIC DIRECTORY")} title={tr("Players")}>
          {tr(error.message)}
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
  const query = new URLSearchParams({ q: filters.q, view });
  const viewHref = (value: "cards" | "list") => {
    const next = new URLSearchParams(query);
    next.set("view", value);
    next.set("page", String(filters.page));
    return `${base}?${next}`;
  };
  return (
    <div className="directory-page edition-players">
      <PageHeading title={tr("Players")} />
      <div className={styles.toolbar}>
        <form action={base} method="get" className={`filters ${styles.search}`}>
          <input type="hidden" name="view" value={view} />
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
        <nav className={styles.views} aria-label={tr("Player view")}>
          {(["cards", "list"] as const).map((value) => (
            <Link
              key={value}
              href={viewHref(value)}
              prefetch={false}
              scroll={false}
              aria-current={view === value ? "page" : undefined}
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 20 20"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
              >
                {value === "cards" ? (
                  <path d="M3 3h5v5H3zM12 3h5v5h-5zM3 12h5v5H3zM12 12h5v5h-5z" />
                ) : (
                  <path d="M3 4h14M3 10h14M3 16h14" />
                )}
              </svg>
              {value === "cards" ? tr("Cards") : tr("List")}
            </Link>
          ))}
        </nav>
      </div>
      {total > 0 && (
        <p className="muted small" role="status">
          {total} {tr(" player ")}
          {total === 1 ? tr("entry") : tr("entries")}
        </p>
      )}
      {rows.length ? (
        <>
          {view === "list" && (
            <p
              id="player-statistics"
              className={`muted small ${styles.listMode}`}
            >
              {"osu!standard"} · {tr("Cached statistics")}
            </p>
          )}
          <ul
            className={view === "list" ? styles.list : styles.grid}
            aria-describedby={view === "list" ? "player-statistics" : undefined}
          >
            {rows.map((p) => {
              const stats = statistics.get(p.osuId);
              const updated = stats
                ? tr("Updated {value0}{value1}", {
                    value0: formatDate(stats.fetchedAt, "UTC", tr.locale),
                    value1: "",
                  })
                : tr("osu! statistics are temporarily unavailable.");
              return (
                <li
                  className={view === "list" ? styles.row : styles.card}
                  key={p.osuId}
                >
                  <div className={styles.identity}>
                    <PublicPlayerIdentity
                      osuId={p.osuId}
                      username={p.username}
                    />
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
                    <div
                      className={`${styles.mode}${view === "list" ? " sr-only" : ""}`}
                    >
                      {view === "cards" && <span>{"osu!standard"}</span>}
                      {stats?.stale && <span>{tr("SAVED SNAPSHOT")}</span>}
                      {stats && (
                        <time className="sr-only" dateTime={stats.fetchedAt}>
                          {updated}
                        </time>
                      )}
                    </div>
                    <dl>
                      <div>
                        <dt>
                          {tr("Global rank")}
                          {view === "list" && stats?.stale && (
                            <span
                              className={styles.snapshot}
                              role="img"
                              aria-label={tr("SAVED SNAPSHOT")}
                              title={`${tr("SAVED SNAPSHOT")} · ${updated}`}
                            >
                              <svg
                                aria-hidden="true"
                                width="12"
                                height="12"
                                viewBox="0 0 16 16"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.4"
                              >
                                <circle cx="8" cy="8" r="6" />
                                <path d="M8 4v4l2 1" />
                              </svg>
                            </span>
                          )}
                        </dt>
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
                    <span className={styles.status}>
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
                    </span>
                    {p.team ? (
                      <Link
                        className={`context-link ${styles.team}`}
                        href={`/tournaments/${edition}/teams/${p.team.id}`}
                      >
                        {p.team.name}
                      </Link>
                    ) : (
                      <span
                        className={`muted ${styles.team}`}
                        title={tr("Team")}
                      >
                        {tr("Not announced")}
                      </span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="directory-empty" role="status">
          <p className="muted">
            {filters.q
              ? tr("No matching players")
              : tr("No accepted players yet")}
          </p>
          {filters.q && (
            <Link className="context-link" href={`${base}?view=${view}`}>
              {tr("Clear filters")}
            </Link>
          )}
        </div>
      )}
      <nav className="actions spaced" aria-label={tr("Player directory pages")}>
        {filters.page > 1 && (
          <Link
            className="button secondary"
            prefetch={false}
            href={`${base}?${query}&page=${filters.page - 1}`}
          >
            {tr("← Previous")}
          </Link>
        )}
        {filters.page * 24 < total && (
          <Link
            className="button secondary"
            prefetch={false}
            href={`${base}?${query}&page=${filters.page + 1}`}
          >
            {tr("Next →")}
          </Link>
        )}
      </nav>
    </div>
  );
}
