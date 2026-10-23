import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArchivePlayerSearch } from "./archive-player-search";
import { ArchiveMappools } from "./archive-mappools";
import { Avatar } from "./avatar";
import { ArchiveMatchList } from "./archive-match-list";
import { BracketView } from "./bracket-view";
import { archiveBracket } from "@/lib/archive-bracket";
import { getAppTranslations } from "@/i18n/server";
import { getPublicEdition } from "@/lib/content";
import { formatDate, type Edition } from "@/lib/editions";
import {
  archiveCounts,
  type HistoricalArchive,
} from "@/lib/historical-archive";
import { PageHeading, Badge } from "./ui";
import { RulesHandbook } from "./rules-handbook";
import { historicalRulebook } from "@/lib/historical-rulebooks";

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
  | "staff"
  | "rules"
  | "awards";
export async function historicalPage(
  slug: string,
  section: ArchiveSection,
  id?: string,
) {
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  if (edition.archive && section === "results")
    redirect(`/tournaments/${slug}/schedule?status=recorded`);
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
  const rosterCard = (
    p: HistoricalArchive["players"][number],
    showTeam = true,
  ) => (
    <li className="archive-player-card" key={p.osuId} data-role={p.role}>
      <Link
        href={href("players", String(p.osuId))}
        tabIndex={-1}
        aria-hidden="true"
      >
        <Avatar osuId={p.osuId} username={p.username} />
      </Link>
      <div className="archive-player-copy">
        <div className="archive-player-name">
          {playerLink(p)} <Badge>{role(p)}</Badge>
        </div>
        <span className="muted small">
          {tr("osu! ID ")}
          {p.osuId}
        </span>
        {showTeam && p.teamId && (
          <span className="archive-player-team">{teamLink(p.teamId)}</span>
        )}
      </div>
    </li>
  );
  const roster = (members: HistoricalArchive["players"], showTeam = true) => (
    <ul className="archive-player-grid">
      {members.map((p) => rosterCard(p, showTeam))}
    </ul>
  );
  const match = (m: HistoricalArchive["matches"][number]) => (
    <article className="archive-match" key={m.id} data-recorded={!!m.score}>
      <header className="archive-match-meta">
        <Link className="text-link" href={href("matches", m.id)}>
          {m.label}
        </Link>
        <span>{m.stage}</span>
        <span className="muted small">
          {m.scheduledAt
            ? formatDate(m.scheduledAt, edition.timeZone, tr.locale)
            : tr("Not recorded")}
        </span>
      </header>
      <div className="archive-scoreboard">
        {[m.teamA, m.teamB].map((teamId, i) => {
          const won = m.score && m.score[i] > m.score[1 - i];
          return (
            <div
              className="archive-score-team"
              key={teamId}
              data-winner={won || undefined}
            >
              <span>
                {teamLink(teamId)}
                {won && <span className="sr-only">{tr(" (winner)")}</span>}
              </span>
              <strong>{m.score?.[i] ?? "—"}</strong>
            </div>
          );
        })}
      </div>
      <footer className="archive-match-footer">
        <span className="small muted">
          {m.score ? tr("Recorded results") : tr("Unconfirmed records")}
        </span>
        <div className="archive-match-links">
          {m.mpUrls.map((url, i) => (
            <a className="text-link" key={url} href={url} rel="noreferrer">
              MP {i + 1}
            </a>
          ))}
          {m.vodUrl && (
            <a className="text-link" href={m.vodUrl} rel="noreferrer">
              {tr("Watch replay")}
            </a>
          )}
        </div>
      </footer>
      {!m.score && (
        <p className="muted small archive-unconfirmed">
          {tr("Schedule record only; completion and result are not confirmed.")}
        </p>
      )}
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
        {preview && (
          <nav className="actions" aria-label={tr("Archive sections")}>
            {[
              ["teams", tr("Teams")],
              ["players", tr("Players")],
              ["schedule", tr("Schedule")],
              ["mappools", tr("Mappools")],
              ["draft", tr("Draft results")],
              ["staff", tr("Staff")],
            ].map(([path, label]) => (
              <Link key={path} href={href(path)}>
                {label}
              </Link>
            ))}
          </nav>
        )}
      </>
    );
  } else if (section === "staff") {
    title = tr("Staff");
    const groups = new Map<string, HistoricalArchive["staff"]>();
    for (const person of a.staff) {
      const members = groups.get(person.position) ?? [];
      members.push(person);
      groups.set(person.position, members);
    }
    content = groups.size ? (
      <div className="archive-staff stack">
        {Array.from(groups, ([position, members]) => (
          <section key={position}>
            <h2>{position}</h2>
            <ul className="public-staff-list">
              {members.map((person, index) => (
                <li key={`${person.osuId}-${index}`}>
                  <Avatar osuId={person.osuId} username={person.username} />
                  <div>
                    <h3>
                      <a
                        className="context-link"
                        href={`https://osu.ppy.sh/users/${person.osuId}`}
                        rel="noreferrer"
                      >
                        {person.username}
                      </a>
                    </h3>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    ) : (
      <p className="muted">{tr("Not recorded")}</p>
    );
  } else if (section === "teams" || section === "team") {
    const teams =
      section === "team" ? a.teams.filter((t) => t.id === id) : a.teams;
    if (!teams.length) notFound();
    title = section === "team" ? teams[0].name : tr("Teams");
    content = (
      <div className="stack">
        {teams.map((t) => (
          <section className="archive-team-section" key={t.id}>
            {section === "teams" && <h2>{teamLink(t.id)}</h2>}
            {roster(
              a.players.filter((p) => p.teamId === t.id),
              false,
            )}
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
        {section === "players" ? (
          <ArchivePlayerSearch
            players={players.map((p) => ({
              id: p.osuId,
              searchText: [
                p.username,
                p.osuId,
                p.teamId ? team(p.teamId).name : "",
              ].join(" "),
              card: rosterCard(p),
            }))}
          />
        ) : (
          roster(players)
        )}
        {section === "player" && (
          <>
            <a
              href={`https://osu.ppy.sh/users/${players[0].osuId}`}
              rel="noreferrer"
            >
              {tr("osu! profile")}
            </a>
          </>
        )}
      </>
    );
  } else if (["schedule", "results", "match"].includes(section)) {
    const matches = a.matches
      .filter((m) => preview || m.score !== null)
      .filter((m) =>
        section === "match"
          ? m.id === id
          : section !== "results" || m.score !== null,
      )
      .sort((x, y) =>
        (x.scheduledAt ?? "9999").localeCompare(y.scheduledAt ?? "9999"),
      );
    if (section === "match" && !matches.length) notFound();
    title = section === "match" ? matches[0].label : tr("Matches & results");
    content =
      section === "match" ? (
        match(matches[0])
      ) : (
        <ArchiveMatchList
          reviewMode={preview}
          recordedOnly={section === "results"}
          matches={matches.map((m) => ({
            id: m.id,
            stage: m.stage,
            recorded: !!m.score,
            content: match(m),
          }))}
        />
      );
  } else if (section === "mappools" || section === "pool") {
    const pool =
      section === "pool" ? a.pools.find((p) => p.id === id) : a.pools[0];
    if (section === "pool" && !pool) notFound();
    title = tr("Mappools");
    content = pool ? (
      <ArchiveMappools
        key={pool.id}
        pool={pool}
        stages={a.pools.map((p) => ({
          id: p.id,
          name: p.name,
          count: p.maps.length,
          href: href("mappools", p.id),
        }))}
      />
    ) : (
      <p className="notice">{tr("No mappools recorded.")}</p>
    );
  } else if (section === "bracket") {
    title = tr("Bracket");
    const bracket = archiveBracket(a, (id) => href("matches", id));
    if (bracket)
      for (const group of bracket.groups)
        if (group.id === "match-path") group.label = tr("Match path");
    content = (
      <>
        <p className="muted small">
          {tr(
            "Generated from recorded matches. Lines connect each team's previous recorded appearance; they do not establish qualification rules. Unconfirmed alternatives are excluded.",
          )}
        </p>
        {bracket ? (
          <BracketView
            bracket={bracket}
            teamUrls={Object.fromEntries(
              a.teams.map((t) => [t.id, href("teams", t.id)]),
            )}
          />
        ) : (
          <p>{tr("No recorded matches.")}</p>
        )}
        <h2>{tr("Group standings")}</h2>
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
                  (x, y) =>
                    x.group.localeCompare(y.group) ||
                    (x.rank ?? Number.MAX_SAFE_INTEGER) -
                      (y.rank ?? Number.MAX_SAFE_INTEGER),
                )
                .map((s) => (
                  <tr key={s.teamId}>
                    <td>{s.group}</td>
                    <td>{s.rank ?? tr("Not recorded")}</td>
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
      <div className="archive-draft">
        {[...new Set(a.picks.map((p) => p.round))]
          .sort((a, b) => a - b)
          .map((round) => (
            <section className="archive-draft-round" key={round}>
              <header>
                <h2>{tr("Round {round}", { round })}</h2>
                <span className="muted small">{`Tier ${round}`}</span>
              </header>
              <ol className="archive-draft-picks">
                {a.picks
                  .filter((p) => p.round === round)
                  .sort((a, b) => a.pick - b.pick)
                  .map((pick) => {
                    const p = player(pick.osuId);
                    return (
                      <li key={p.osuId} value={pick.pick}>
                        <span
                          className="archive-pick-number"
                          aria-label={tr("Pick {pick}", { pick: pick.pick })}
                        >
                          {String(pick.pick).padStart(2, "0")}
                        </span>
                        <Avatar osuId={p.osuId} username={p.username} />
                        <div>
                          <strong>{playerLink(p)}</strong>
                          <span className="small muted">
                            {teamLink(pick.teamId)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
              </ol>
            </section>
          ))}
      </div>
    );
  } else if (section === "rules") {
    title = tr("Rules");
    const rules = historicalRulebook(a);
    content = rules ? (
      <>
        <p className="rules-version muted small">
          {rules.version ? (
            <>
              {tr("Version ")}
              {rules.version} ·{" "}
            </>
          ) : null}
          {rules.sections.length} {tr("sections")}
        </p>
        <RulesHandbook
          sections={rules.sections}
          cover={rules.cover}
          archiveSeason={a.season}
        />
      </>
    ) : (
      <p className="muted">{tr("Not recorded")}</p>
    );
  } else {
    title = tr("Historical statistics");
    content = <p className="muted">{tr("Not recorded")}</p>;
  }
  return (
    <div
      className={`historical-archive stack${section === "mappools" || section === "pool" ? " archive-pool-page" : ""}`}
    >
      <PageHeading eyebrow={tr("Historical archive")} title={title}>
        {section === "overview" ? edition.summary : undefined}
      </PageHeading>
      {preview && <p className="notice">{tr("Private archive preview")}</p>}
      {section !== "overview" && preview && (
        <Link className="text-link" href={base}>
          {tr("Archive overview")}
        </Link>
      )}
      {content}
    </div>
  );
}
