"use client";
import Link from "next/link";
import { useState } from "react";
import type { PublicFixture, PublicGroup } from "@/lib/public-competition";
import { formatDate } from "@/lib/editions";

export function MatchCard({
  fixture: f,
  slug,
}: {
  fixture: PublicFixture;
  slug: string;
}) {
  const status =
    f.status === "cancelled"
      ? "Cancelled"
      : f.result
        ? "Published result"
        : f.confirmed
          ? f.status.replaceAll("_", " ")
          : "Awaiting fixture confirmation";
  return (
    <article className="panel public-match-card">
      <div className="match-meta">
        <span className="eyebrow">
          {f.stage === "group" ? "GROUP STAGE" : "KNOCKOUT STAGE"} /{" "}
          {f.roundName}
        </span>
        <span className="badge">{status}</span>
      </div>
      <h3>
        <Link
          href={`/tournaments/${slug}/matches/${f.id}`}
          className="text-link"
        >
          {f.label}
        </Link>
      </h3>
      <div className="match-versus">
        <span>{f.home.label}</span>
        <strong
          aria-label={
            f.result
              ? `Score ${f.result.homeWins} to ${f.result.awayWins}`
              : "Versus"
          }
        >
          {f.result ? `${f.result.homeWins} : ${f.result.awayWins}` : "vs"}
        </strong>
        <span>{f.away.label}</span>
      </div>
      <p className="match-time muted">
        {f.scheduledAt ? (
          <time dateTime={f.scheduledAt}>
            {formatDate(f.scheduledAt, f.timeZone)}
          </time>
        ) : (
          "Match time TBA"
        )}{" "}
        · {f.timeZone}
      </p>
      <details className="match-public-details">
        <summary>Match details</summary>
        <div>
          {f.pool && (
            <p>
              <Link
                className="text-link"
                href={`/tournaments/${slug}/mappools/${f.pool.id}`}
              >
                Released mappool: {f.pool.name}
              </Link>
            </p>
          )}
          {f.result && (
            <>
              <p className="small muted">
                {f.result.draw
                  ? "Approved draw"
                  : `Winner: ${f.result.winnerTeamId === f.home.team?.id ? f.home.label : f.away.label}`}{" "}
                · Updated {formatDate(f.result.updatedAt, f.timeZone)}
              </p>
              <a className="text-link" href={f.result.mpUrl}>
                osu! match source
              </a>
            </>
          )}
          <p>
            <Link
              className="text-link"
              href={`/tournaments/${slug}/matches/${f.id}`}
            >
              Open match
            </Link>
          </p>
        </div>
      </details>
    </article>
  );
}

export function PublicMatches({
  fixtures,
  slug,
  groups = [],
}: {
  fixtures: PublicFixture[];
  slug: string;
  groups?: PublicGroup[];
}) {
  const [stage, setStage] = useState("");
  const [round, setRound] = useState("");
  const [status, setStatus] = useState("");
  const [group, setGroup] = useState("");
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"cards" | "compact">("cards");
  const stages = [...new Set(fixtures.map((f) => f.stage))];
  const rounds = [
    ...new Map(
      fixtures
        .filter((f) => !stage || f.stage === stage)
        .map((f) => [f.roundId, f.roundName]),
    ).entries(),
  ];
  const selectedGroup = groups.find((g) => g.key === group);
  const term = search.trim().toLocaleLowerCase();
  const matches = fixtures.filter(
    (f) =>
      (!stage || f.stage === stage) &&
      (!round || f.roundId === round) &&
      (!selectedGroup ||
        (selectedGroup.rows.some((r) => r.team.id === f.home.team?.id) &&
          selectedGroup.rows.some((r) => r.team.id === f.away.team?.id))) &&
      (!status ||
        (status === "completed"
          ? Boolean(f.result)
          : status === "pending"
            ? !f.result && f.status !== "cancelled"
            : f.status === "cancelled")) &&
      (!term ||
        [f.label, f.roundName, f.home.label, f.away.label, f.result?.mpId]
          .join(" ")
          .toLocaleLowerCase()
          .includes(term)),
  );
  return (
    <section className="public-matches stack">
      <div className="public-match-toolbar">
        <div
          className="event-pills"
          role="group"
          aria-label="Competition stage"
        >
          {[
            ["", "All stages"],
            ...stages.map((value) => [
              value,
              value === "group" ? "Group Stage" : "Knockout Stage",
            ]),
          ].map(([value, label]) => (
            <button
              key={value}
              className="secondary"
              type="button"
              aria-pressed={stage === value}
              onClick={() => {
                setStage(value);
                setRound("");
                setGroup("");
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="event-pills" role="group" aria-label="Match view">
          {(["cards", "compact"] as const).map((value) => (
            <button
              className="secondary"
              key={value}
              type="button"
              aria-pressed={view === value}
              onClick={() => setView(value)}
            >
              {value === "cards" ? "Cards" : "Compact"}
            </button>
          ))}
        </div>
      </div>
      <div className="public-match-filters">
        <label className="field">
          <span>Search matches</span>
          <input
            type="search"
            value={search}
            placeholder="Team, match or MP ID"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        {rounds.length > 1 && (
          <label className="field">
            <span>Competition round</span>
            <select value={round} onChange={(e) => setRound(e.target.value)}>
              <option value="">All rounds</option>
              {rounds.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        )}
        {groups.length > 0 && stage !== "knockout" && (
          <label className="field">
            <span>Group</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.key} value={g.key}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="field">
          <span>Match publication status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All matches</option>
            <option value="completed">Published results</option>
            <option value="pending">Awaiting result</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>
      </div>
      <p className="muted small" role="status">
        {matches.length} published fixture{matches.length === 1 ? "" : "s"}
      </p>
      {[...new Set(matches.map((f) => f.roundId))].map((roundId) => {
        const group = matches.filter((f) => f.roundId === roundId);
        return (
          <section
            className="public-match-round"
            key={roundId}
            aria-labelledby={`public-round-${roundId}`}
          >
            <h2 id={`public-round-${roundId}`}>
              {group[0].stage === "group" ? "Group Stage" : "Knockout Stage"} ·{" "}
              {group[0].roundName}
            </h2>
            <div className="public-match-list" data-view={view}>
              {group.map((f) => (
                <MatchCard key={f.id} fixture={f} slug={slug} />
              ))}
            </div>
          </section>
        );
      })}
      {!matches.length && (
        <p className="notice">
          No published fixtures match these filters. Confirmed matches will
          appear here when released.
        </p>
      )}
    </section>
  );
}
export function GroupStandings({
  groups,
  slug,
}: {
  groups: PublicGroup[];
  slug: string;
}) {
  return (
    <section
      className="section-space stack"
      aria-labelledby="standings-heading"
    >
      <div>
        <p className="eyebrow">GROUP STAGE</p>
        <h2 id="standings-heading">Standings</h2>
        <p className="muted">
          Only approved, published match results count. Equal ranks remain tied
          until the configured criteria resolve them.
        </p>
      </div>
      {!groups.length && (
        <p className="notice">
          Groups and ranking rules await publication. No ranking is assumed.
        </p>
      )}
      {groups.map((g) => (
        <article className="panel" key={g.key}>
          <h3>{g.name}</h3>
          {g.rankingPending && (
            <p className="notice">
              Ranking pending: confirmed fixtures, points or tiebreak rules are
              incomplete or inconsistent.
            </p>
          )}
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label={`${g.name} standings; scroll horizontally`}
          >
            <table>
              <caption>{g.name}</caption>
              <thead>
                <tr>
                  <th scope="col">Rank</th>
                  <th scope="col">Team</th>
                  <th scope="col">Played</th>
                  <th scope="col">W</th>
                  <th scope="col">L</th>
                  <th scope="col">D</th>
                  <th scope="col">Maps won</th>
                  <th scope="col">Maps lost</th>
                  <th scope="col">Difference</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr key={r.team.id}>
                    <td>{r.rank ?? "—"}</td>
                    <th scope="row">
                      <Link
                        className="text-link"
                        href={`/tournaments/${slug}/teams/${r.team.id}`}
                      >
                        {r.team.name}
                      </Link>
                    </th>
                    <td>{r.played}</td>
                    <td>{r.wins}</td>
                    <td>{r.losses}</td>
                    <td>{r.draws}</td>
                    <td>{r.mapsWon}</td>
                    <td>{r.mapsLost}</td>
                    <td>{r.mapDifference}</td>
                    <td>{r.points ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {g.criteria && (
            <p className="muted small">
              Approved order:{" "}
              {g.criteria.map((c) => c.replaceAll("_", " ")).join(" → ")}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
