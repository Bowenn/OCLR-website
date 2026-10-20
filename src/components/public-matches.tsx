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
  return (
    <article className="panel public-match-card">
      <div className="match-meta">
        <span className="eyebrow">
          {f.stage === "group" ? "GROUP STAGE" : "KNOCKOUT STAGE"} /{" "}
          {f.roundName}
        </span>
        <span className="badge">
          {f.status === "cancelled"
            ? "Cancelled"
            : f.result
              ? "Published result"
              : f.confirmed
                ? f.status.replaceAll("_", " ")
                : "Awaiting fixture confirmation"}
        </span>
      </div>
      <h2>
        <Link
          href={`/tournaments/${slug}/matches/${f.id}`}
          className="text-link"
        >
          {f.label} ↗
        </Link>
      </h2>
      <div className="match-versus">
        <span>{f.home.label}</span>
        <strong>
          {f.result ? `${f.result.homeWins} : ${f.result.awayWins}` : "vs"}
        </strong>
        <span>{f.away.label}</span>
      </div>
      <p className="muted">
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
      {f.result && (
        <p className="small muted">
          {f.result.draw
            ? "Approved draw"
            : `Winner: ${f.result.winnerTeamId === f.home.team?.id ? f.home.label : f.away.label}`}{" "}
          · Updated {formatDate(f.result.updatedAt, f.timeZone)}
        </p>
      )}
    </article>
  );
}
export function PublicMatches({
  fixtures,
  slug,
}: {
  fixtures: PublicFixture[];
  slug: string;
}) {
  const [stage, setStage] = useState("");
  const [round, setRound] = useState("");
  const [status, setStatus] = useState("");
  const rounds = [
    ...new Map(
      fixtures
        .filter((f) => !stage || f.stage === stage)
        .map((f) => [f.roundId, f.roundName]),
    ).entries(),
  ];
  const matches = fixtures.filter(
    (f) =>
      (!stage || f.stage === stage) &&
      (!round || f.roundId === round) &&
      (!status ||
        (status === "completed"
          ? Boolean(f.result)
          : status === "pending"
            ? !f.result && f.status !== "cancelled"
            : f.status === "cancelled")),
  );
  return (
    <section className="stack">
      <div className="match-filters">
        <label className="field">
          <span>Competition stage</span>
          <select
            value={stage}
            onChange={(e) => {
              setStage(e.target.value);
              setRound("");
            }}
          >
            <option value="">All stages</option>
            <option value="group">Group Stage</option>
            <option value="knockout">Knockout Stage</option>
          </select>
        </label>
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
      {matches.map((f) => (
        <MatchCard key={f.id} fixture={f} slug={slug} />
      ))}
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
              <caption>
                {g.name} · {g.version}
              </caption>
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
              {g.criteria.map((c) => c.replaceAll("_", " ")).join(" → ")} ·
              Rules {g.rulesVersions.join(", ")}
            </p>
          )}
        </article>
      ))}
    </section>
  );
}
