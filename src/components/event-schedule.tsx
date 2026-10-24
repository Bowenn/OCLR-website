"use client";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { EventMatch } from "@/lib/event-preview";
import type { PublicGroup } from "@/lib/public-competition";
import { GroupStandings } from "./public-matches";
export function EventSchedule({
  matches,
  groups = [],
  edition,
}: {
  matches: EventMatch[];
  groups?: PublicGroup[];
  edition: string;
}) {
  const tr = useAppTranslations();
  const [phase, setPhase] = useState("group");
  const [filter, setFilter] = useState("");
  const selected = matches.filter((m) => m.stage === phase);
  const rounds = [...new Set(selected.map((m) => m.round))];
  const positions: Record<string, [number, number]> = {
    W1: [20, 56],
    W2: [20, 164],
    L1: [20, 310],
    L2: [20, 418],
    L3: [280, 310],
    L4: [280, 418],
    W3: [540, 110],
    L5: [540, 364],
    L6: [800, 256],
    GF: [1060, 110],
    GF2: [1060, 418],
  };
  const seededLayout =
    selected.length > 0 && selected.every((m) => positions[m.id]);
  if (!seededLayout)
    rounds.forEach((round, x) =>
      selected
        .filter((m) => m.round === round)
        .forEach((m, y) => {
          positions[m.id] = [20 + x * 260, 56 + y * 108];
        }),
    );
  const chartWidth = seededLayout
    ? 1570
    : Math.max(600, rounds.length * 260 + 20);
  const chartHeight = seededLayout
    ? 530
    : Math.max(240, ...selected.map((m) => positions[m.id][1] + 110));
  const structured = phase === "knockout" && selected.length > 0;
  const columns = [
    "Mappool",
    "Match number & time",
    "Red team",
    "Score",
    "Blue team",
    "First pick",
    "Red bans",
    "Blue bans",
    "MPLink",
    "Recording",
    "Referee",
    "Streamer",
  ];
  function card(m: EventMatch) {
    return (
      <article className="event-match-card" id={`match-${m.id}`} key={m.id}>
        <header>
          <a href={`#row-${m.id}`}>#{m.id}</a>
          {m.status === "cancelled" ? (
            <span>{tr("Cancelled")}</span>
          ) : (
            <time>{m.time}</time>
          )}
        </header>
        {[m.red, m.blue].map((name, i) => (
          <div className="event-match-side" key={i}>
            <span>{i + 1}</span>
            <strong>{name}</strong>
            <b>{m.score?.[i] ?? "—"}</b>
          </div>
        ))}
        {(m.sourceRed || m.sourceBlue) && (
          <footer>
            {m.sourceRed} / {m.sourceBlue}
          </footer>
        )}
      </article>
    );
  }
  return (
    <div className="event-schedule">
      <div className="event-section-heading">
        <h1>{tr("Schedule")}</h1>
        <span>{"UTC+8"}</span>
      </div>
      <div className="event-tabs">
        <button
          aria-pressed={phase === "group"}
          onClick={() => setPhase("group")}
        >
          {tr("Group stage / Swiss")}
        </button>
        <button
          aria-pressed={phase === "knockout"}
          onClick={() => setPhase("knockout")}
        >
          {tr("Double elimination")}
        </button>
      </div>
      <div
        className="event-bracket-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr("Bracket")}
      >
        {structured ? (
          <div
            className="event-knockout"
            style={{ minWidth: chartWidth, height: chartHeight }}
          >
            {seededLayout && (
              <>
                <span className="event-knockout-label" style={{ top: 24 }}>
                  {tr("Winners bracket")}
                </span>
                <span className="event-knockout-label" style={{ top: 270 }}>
                  {tr("Losers bracket")}
                </span>
              </>
            )}
            <svg
              viewBox={`0 0 ${chartWidth} ${chartHeight}`}
              aria-hidden="true"
            >
              {selected.flatMap((m) =>
                [m.sourceRed, m.sourceBlue]
                  .filter((source) => source && positions[source])
                  .map((source, i) => {
                    const [sx, sy] = positions[source!];
                    const [tx, ty] = positions[m.id];
                    const y = ty + 30 + i * 24;
                    return (
                      <path
                        key={`${source}-${m.id}-${i}`}
                        d={
                          tx > sx
                            ? `M ${sx + 225} ${sy + 42} H ${sx + 242} V ${y} H ${tx}`
                            : `M ${sx + 225} ${sy + 42} H ${sx + 245 + i * 8} V ${y} H ${tx + 225}`
                        }
                      />
                    );
                  }),
              )}
            </svg>
            {selected.map((m) => (
              <div
                key={m.id}
                style={{
                  position: "absolute",
                  left: positions[m.id][0],
                  top: positions[m.id][1],
                }}
              >
                <div
                  style={{
                    position: "absolute",
                    top: -20,
                    fontSize: ".7rem",
                    whiteSpace: "nowrap",
                  }}
                >
                  {m.round}
                </div>
                {card(m)}
              </div>
            ))}
            {seededLayout && (
              <div className="event-knockout-ranks">
                <h2>{tr("Final standings")}</h2>
                {[
                  "#GF / #GF2 胜者",
                  "#GF / #GF2 败者",
                  "#L6 败者",
                  "#L5 败者",
                  "#L3 / #L4 败者",
                  "#L1 / #L2 败者",
                ].map((name, i) => (
                  <div className="event-standing" key={name}>
                    <b>{["1", "2", "3", "4", "5–6", "7–8"][i]}</b>
                    <span>{name}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div
            className={`event-bracket ${phase === "knockout" ? "event-double" : ""}`}
          >
            {rounds.map((round) => (
              <section className="event-bracket-round" key={round}>
                <h2>{round}</h2>
                {[
                  ...new Set(
                    selected
                      .filter((m) => m.round === round)
                      .map((m) => m.record ?? ""),
                  ),
                ].map((record) => (
                  <div className="event-record" key={record}>
                    {record && <h3>{record}</h3>}
                    {selected
                      .filter(
                        (m) => m.round === round && (m.record ?? "") === record,
                      )
                      .map(card)}
                  </div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
      {phase === "group" && <GroupStandings groups={groups} slug={edition} />}
      <section className="event-match-summary">
        <div className="event-section-heading">
          <h2>{tr("Match information")}</h2>
          <label>
            {tr("Rounds")}
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="">{tr("All rounds")}</option>
              {[...new Set(matches.map((m) => m.round))].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
        </div>
        <div
          className="event-table-scroll"
          tabIndex={0}
          role="region"
          aria-label={tr("Match information")}
        >
          <table className="event-table event-matches">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th scope="col" key={c}>
                    {tr(c)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matches
                .filter((m) => !filter || m.round === filter)
                .map((m) => (
                  <tr key={m.id} id={`row-${m.id}`} data-status={m.status}>
                    <td>
                      <strong>{m.pool}</strong>
                      <small>{m.round}</small>
                    </td>
                    <td>
                      <a
                        href={m.href ?? `#match-${m.id}`}
                        onClick={() => {
                          if (!m.href) setPhase(m.stage);
                        }}
                      >
                        #{m.id}
                      </a>
                      <small>{m.time}</small>
                      {m.status === "cancelled" && (
                        <small>{tr("Cancelled")}</small>
                      )}
                    </td>
                    <td>{m.red}</td>
                    <td className="event-score">
                      {m.score ? m.score.join(" : ") : "—"}
                    </td>
                    <td>{m.blue}</td>
                    <td>
                      {m.first
                        ? tr(m.first === "red" ? "Red team" : "Blue team")
                        : "—"}
                    </td>
                    <td>{m.redBan ?? "—"}</td>
                    <td>{m.blueBan ?? "—"}</td>
                    <td>
                      {m.mp ? (
                        <a href={m.mp} target="_blank" rel="noreferrer">
                          {m.mp.split("/").at(-1)} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {m.vod ? (
                        <a href={m.vod} target="_blank" rel="noreferrer">
                          {tr("Recording")} ↗
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{m.referee ?? "—"}</td>
                    <td>{m.streamer ?? "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
