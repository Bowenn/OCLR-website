import Link from "next/link";
import { notFound } from "next/navigation";
import { getAppTranslations } from "@/i18n/server";
import { getPublicEdition } from "@/lib/content";
import { formatDate, type Edition } from "@/lib/editions";
import {
  archiveCounts,
  type HistoricalArchive,
} from "@/lib/historical-archive";
import { PageHeading, Badge } from "./ui";

export type ArchiveSection =
  | "overview"
  | "teams"
  | "team"
  | "players"
  | "player"
  | "schedule"
  | "results"
  | "match"
  | "mappools"
  | "pool"
  | "bracket"
  | "draft"
  | "rules"
  | "awards";
export async function historicalPage(
  slug: string,
  section: ArchiveSection,
  id?: string,
) {
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  return edition.archive ? (
    <HistoricalArchiveView
      edition={edition}
      archive={edition.archive}
      section={section}
      id={id}
    />
  ) : null;
}

/** Shared by private preview and published, edition-scoped historical pages. */
export async function HistoricalArchiveView({
  edition,
  archive: a,
  section = "overview",
  id,
  preview = false,
}: {
  edition: Edition;
  archive: HistoricalArchive;
  section?: ArchiveSection;
  id?: string;
  preview?: boolean;
}) {
  const tr = await getAppTranslations();
  const base = preview
    ? `/admin/tournaments/${edition.slug}/archive/preview`
    : `/tournaments/${edition.slug}`;
  const href = (section: string, id?: string) =>
    preview
      ? `${base}?section=${section}${id ? `&id=${encodeURIComponent(id)}` : ""}`
      : `${base}/${section}${id ? `/${id}` : ""}`;
  const team = (id: string) => a.teams.find((t) => t.id === id)!;
  const player = (id: number) => a.players.find((p) => p.osuId === id)!;
  const teamLink = (id: string) => (
    <Link href={href("teams", id)}>{team(id).name}</Link>
  );
  const playerLink = (p: HistoricalArchive["players"][number]) => (
    <Link href={href("players", String(p.osuId))}>{p.username}</Link>
  );
  const role = (p: HistoricalArchive["players"][number]) =>
    p.role === "captain"
      ? "Captain"
      : p.role === "coach"
        ? tr("Coach")
        : p.role === "free_agent"
          ? tr("Free agent")
          : p.tier === null
            ? tr("Not recorded")
            : `Tier ${p.tier}`;
  const source = (ref: string) => (
    <p className="muted small">
      {tr("Source")}: {ref}
    </p>
  );
  const roster = (members: HistoricalArchive["players"]) => (
    <ul className="archive-roster">
      {members.map((p) => (
        <li key={p.osuId}>
          <div>
            {playerLink(p)} <Badge>{role(p)}</Badge>
          </div>
          {p.teamId && <span>{teamLink(p.teamId)}</span>}
        </li>
      ))}
    </ul>
  );
  const match = (m: HistoricalArchive["matches"][number]) => (
    <article className="panel stack" key={m.id}>
      <div className="section-title">
        <Link href={href("matches", m.id)}>{m.label}</Link>
        <span>{m.stage}</span>
      </div>
      <div className="archive-versus">
        {teamLink(m.teamA)}
        <strong>{m.score ? m.score.join(" : ") : tr("Not recorded")}</strong>
        {teamLink(m.teamB)}
      </div>
      <p className="muted">
        {m.scheduledAt
          ? formatDate(m.scheduledAt, edition.timeZone, tr.locale)
          : tr("Not recorded")}
      </p>
      {!m.score && (
        <p className="notice">
          {tr("Schedule record only; completion and result are not confirmed.")}
        </p>
      )}
      <div className="actions">
        {m.mpUrls.map((url, i) => (
          <a key={url} href={url} rel="noreferrer">
            MP {i + 1}
          </a>
        ))}
        {m.vodUrl && (
          <a href={m.vodUrl} rel="noreferrer">
            {tr("Watch replay")}
          </a>
        )}
      </div>
      {section === "match" && (
        <>
          <dl className="detail-list">
            {[
              [tr("Referee"), m.referee],
              [tr("Streamer"), m.streamer],
              [tr("Commentators"), m.commentators],
              [tr("Red bans"), m.bansA],
              [tr("Blue bans"), m.bansB],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value ?? tr("Not recorded")}</dd>
              </div>
            ))}
          </dl>
          {source(m.source)}
        </>
      )}
    </article>
  );
  let content;
  let title = edition.name;
  if (section === "overview") {
    const counts = archiveCounts(a);
    content = (
      <>
        <p>{edition.summary}</p>
        <dl className="archive-counts">
          {[
            [tr("Teams"), counts.teams],
            [tr("Players & coaches"), counts.players],
            [tr("Recorded results"), counts.results],
            [tr("Mappools"), counts.pools],
            [tr("Maps"), counts.maps],
          ].map(([label, count]) => (
            <div key={label}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
        <nav className="actions" aria-label={tr("Archive sections")}>
          {[
            ["teams", tr("Teams")],
            ["players", tr("Players")],
            ["schedule", tr("Schedule")],
            ["mappools", tr("Mappools")],
            ["draft", tr("Draft results")],
          ].map(([path, label]) => (
            <Link key={path} href={href(path)}>
              {label}
            </Link>
          ))}
        </nav>
        <section className="stack">
          <h2>{tr("Sources and coverage")}</h2>
          <a href={a.sourceUrl} rel="noreferrer">
            {tr("Original archive spreadsheet")}
          </a>
          <p>
            {tr("Source snapshot date")}: {a.capturedOn}
          </p>
          <ul>
            {a.notes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
          <ul>
            {a.links.map((link, i) => (
              <li key={i}>
                <a href={link.url} rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <h2>{tr("Historical staff")}</h2>
          <ul className="archive-roster">
            {a.staff.map((s, i) => (
              <li key={i}>
                <a
                  href={`https://osu.ppy.sh/users/${s.osuId}`}
                  rel="noreferrer"
                >
                  {s.username}
                </a>
                <span>{s.position}</span>
              </li>
            ))}
          </ul>
        </section>
      </>
    );
  } else if (section === "teams" || section === "team") {
    const teams =
      section === "team" ? a.teams.filter((t) => t.id === id) : a.teams;
    if (!teams.length) notFound();
    title = section === "team" ? teams[0].name : tr("Teams");
    content = (
      <div className="stack">
        {teams.map((t) => (
          <section className="panel" key={t.id}>
            {section === "teams" && <h2>{teamLink(t.id)}</h2>}
            {roster(a.players.filter((p) => p.teamId === t.id))}
            {source(t.source)}
          </section>
        ))}
      </div>
    );
  } else if (section === "players" || section === "player") {
    const players =
      section === "player"
        ? a.players.filter((p) => String(p.osuId) === id)
        : a.players;
    if (!players.length) notFound();
    title = section === "player" ? players[0].username : tr("Players");
    content = (
      <>
        {roster(players)}
        {section === "player" && (
          <>
            <a
              href={`https://osu.ppy.sh/users/${players[0].osuId}`}
              rel="noreferrer"
            >
              {tr("osu! profile")}
            </a>
            {source(players[0].source)}
          </>
        )}
      </>
    );
  } else if (["schedule", "results", "match"].includes(section)) {
    const matches = a.matches
      .filter((m) =>
        section === "match"
          ? m.id === id
          : section !== "results" || m.score !== null,
      )
      .sort((x, y) =>
        (x.scheduledAt ?? "9999").localeCompare(y.scheduledAt ?? "9999"),
      );
    if (section === "match" && !matches.length) notFound();
    title =
      section === "match"
        ? matches[0].label
        : section === "results"
          ? tr("Recorded results")
          : tr("Schedule");
    content = <div className="stack">{matches.map(match)}</div>;
  } else if (section === "mappools" || section === "pool") {
    const pools =
      section === "pool" ? a.pools.filter((p) => p.id === id) : a.pools;
    if (section === "pool" && !pools.length) notFound();
    title = section === "pool" ? pools[0].name : tr("Mappools");
    content = (
      <div className="stack">
        {pools.map((p) => (
          <section key={p.id}>
            {section === "mappools" && (
              <h2>
                <Link href={href("mappools", p.id)}>{p.name}</Link>
              </h2>
            )}
            {section === "pool" ? (
              <div
                className="table-scroll"
                tabIndex={0}
                role="region"
                aria-label={p.name}
              >
                <table className="archive-pool-table">
                  <thead>
                    <tr>
                      {[
                        tr("Slot"),
                        tr("Beatmap"),
                        tr("Mapper"),
                        tr("SR"),
                        tr("BPM"),
                        tr("Drain"),
                        tr("CS"),
                        tr("AR"),
                        tr("OD"),
                      ].map((h) => (
                        <th key={h}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {p.maps.map((m) => (
                      <tr key={m.slot}>
                        <th scope="row">{m.slot}</th>
                        <td>
                          {m.beatmapId ? (
                            <a
                              href={`https://osu.ppy.sh/beatmaps/${m.beatmapId}`}
                              rel="noreferrer"
                            >
                              {m.title}
                            </a>
                          ) : (
                            <>
                              {m.title}
                              <p className="muted small">
                                {tr("Beatmap ID unresolved")}
                              </p>
                            </>
                          )}
                        </td>
                        <td>{m.mapper ?? tr("Not recorded")}</td>
                        {[m.stars, m.bpm, m.drainSeconds, m.cs, m.ar, m.od].map(
                          (v, i) => (
                            <td key={i}>
                              {v === null
                                ? tr("Not recorded")
                                : new Intl.NumberFormat(tr.locale, {
                                    maximumFractionDigits: 2,
                                  }).format(v)}
                            </td>
                          ),
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p>
                {p.maps.length} {tr("Maps")}
              </p>
            )}
            {source(p.source)}
          </section>
        ))}
      </div>
    );
  } else if (section === "bracket") {
    title = tr("Group standings");
    content = (
      <>
        <p className="muted">
          {tr(
            "Historical standings from the source; no bracket progression is inferred.",
          )}
        </p>
        <div
          className="table-scroll"
          tabIndex={0}
          role="region"
          aria-label={title}
        >
          <table>
            <thead>
              <tr>
                {[
                  tr("Group"),
                  tr("Rank"),
                  tr("Team"),
                  tr("Wins"),
                  tr("Losses"),
                  tr("Maps won"),
                  tr("Maps lost"),
                ].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...a.standings]
                .sort(
                  (x, y) => x.group.localeCompare(y.group) || x.rank - y.rank,
                )
                .map((s) => (
                  <tr key={s.teamId}>
                    <td>{s.group}</td>
                    <td>{s.rank}</td>
                    <td>{teamLink(s.teamId)}</td>
                    <td>{s.wins}</td>
                    <td>{s.losses}</td>
                    <td>{s.mapsWon}</td>
                    <td>{s.mapsLost}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </>
    );
  } else if (section === "draft") {
    title = tr("Draft results");
    content = (
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={title}
      >
        <table>
          <thead>
            <tr>
              {[tr("Round"), tr("Pick"), tr("Team"), tr("Player")].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...a.picks]
              .sort((x, y) => x.round - y.round || x.pick - y.pick)
              .map((p) => (
                <tr key={p.osuId}>
                  <td>{p.round}</td>
                  <td>{p.pick}</td>
                  <td>{teamLink(p.teamId)}</td>
                  <td>{playerLink(player(p.osuId))}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    );
  } else {
    title = section === "rules" ? tr("Rules") : tr("Historical statistics");
    content = (
      <>
        <p>
          {tr(
            "Consult the historical sources. Current-season rules and award calculations are not applied to this archive.",
          )}
        </p>
        <ul>
          {a.links.map((link, i) => (
            <li key={i}>
              <a href={link.url} rel="noreferrer">
                {link.label}
              </a>
            </li>
          ))}
        </ul>
      </>
    );
  }
  return (
    <div className="historical-archive stack">
      <PageHeading eyebrow={tr("Historical archive")} title={title}>
        <span>
          {tr(
            "Historical source records; missing information remains unconfirmed.",
          )}
        </span>
      </PageHeading>
      {preview && <p className="notice">{tr("Private archive preview")}</p>}
      {section !== "overview" && (
        <Link href={base}>{tr("Archive overview")}</Link>
      )}
      {content}
    </div>
  );
}
