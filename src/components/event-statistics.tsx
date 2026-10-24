"use client";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { EventScore } from "@/lib/event-statistics";
const views = [
  "Performance scores",
  "Mappool statistics",
  "Individual leaderboard",
  "Team leaderboard",
  "Team placements",
  "Solo placements",
];
export function EventStatistics({ scores }: { scores: EventScore[] }) {
  const tr = useAppTranslations();
  const [view, setView] = useState(0),
    [round, setRound] = useState(""),
    [team, setTeam] = useState(""),
    [slot, setSlot] = useState(""),
    [query, setQuery] = useState("");
  const [sort, setSort] = useState("Average score"),
    [descending, setDescending] = useState(true);
  const eligible = scores.filter(
    (s) => (!round || s.round === round) && (!slot || s.slot === slot),
  );
  const plays = eligible.filter((s) => !team || s.team === team);
  const number = (v: number, d = 0) =>
    v.toLocaleString(tr.locale, { maximumFractionDigits: d });
  const avg = (s: EventScore[], key: "score" | "accuracy") => {
    const values = s.flatMap((p) => (p[key] === null ? [] : [p[key]!]));
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  };
  type Cell = string | number | null;
  type Row = Record<string, Cell>;
  let columns: string[] = [];
  let rows: Row[] = [];
  const keys = [
    ...new Set(
      plays.map((s) =>
        view === 1 ? s.slot : view === 3 || view === 4 ? s.team : s.player,
      ),
    ),
  ];
  const slots = [...new Set(plays.map((s) => s.slot))];
  if (view === 0) {
    columns = [
      "Player",
      "Team",
      "MC",
      "Played",
      "Participation rate",
      "MVPs",
      "Average score",
      "Average accuracy",
      "Highest score",
      "Grade",
      "Map",
      "Mods",
      "Match",
    ];
    rows = keys.map((name) => {
      const p = plays.filter((s) => s.player === name);
      const best = [...p].sort((a, b) => b.score - a.score)[0];
      return {
        Player: name,
        Team: best.team,
        MC: p[0].mc ?? null,
        Played: p.length,
        "Participation rate":
          p.length /
          new Set(
            eligible.filter((s) => s.team === best.team).map((s) => s.game),
          ).size,
        MVPs: p.filter(
          (s) =>
            !eligible.some(
              (other) => other.game === s.game && other.score > s.score,
            ),
        ).length,
        "Average score": avg(p, "score"),
        "Average accuracy": avg(p, "accuracy"),
        "Highest score": best.score,
        Grade: best.grade ?? null,
        Map: best.slot,
        Mods: best.mods,
        Match: best.mp,
      };
    });
  } else if (view === 1) {
    columns = [
      "Map",
      "Beatmap",
      "Map ID",
      "Best player",
      "Score",
      "Accuracy",
      "Mods",
      "Match",
      "Best team",
      "Team score",
      "Team match",
      "Average score",
      "Average accuracy",
      "Average team score",
      "Picks",
      "Pick rate",
      "Bans",
      "Ban rate",
    ];
    rows = keys.map((key) => {
      const p = plays.filter((s) => s.slot === key);
      const best = [...p].sort((a, b) => b.score - a.score)[0];
      const teams = [...new Set(p.map((s) => s.game + ":" + s.team))]
        .map((g) => {
          const a = p.filter((s) => s.game + ":" + s.team === g);
          return {
            name: a[0].team,
            total: a.reduce((n, s) => n + s.score, 0),
            mp: a[0].mp,
          };
        })
        .sort((a, b) => b.total - a.total);
      const games = new Set(p.map((s) => s.game)).size;
      return {
        Map: key,
        Beatmap: best.title,
        "Map ID": best.mapId,
        "Best player": best.player,
        Score: best.score,
        Accuracy: best.accuracy,
        Mods: best.mods,
        Match: best.mp,
        "Best team": teams[0]?.name ?? null,
        "Team score": teams[0]?.total ?? null,
        "Team match": teams[0]?.mp ?? null,
        "Average score": avg(p, "score"),
        "Average accuracy": avg(p, "accuracy"),
        "Average team score": teams.length
          ? teams.reduce((n, s) => n + s.total, 0) / teams.length
          : null,
        Picks: games,
        "Pick rate":
          new Set(p.map((s) => s.fixture)).size /
          (best.poolMatches ?? new Set(eligible.map((s) => s.fixture)).size),
        Bans: best.bans ?? null,
        "Ban rate":
          best.bans !== undefined && best.poolMatches
            ? best.bans / best.poolMatches
            : null,
      };
    });
  } else if (view === 2 || view === 3) {
    columns =
      view === 2
        ? [
            "Map",
            "Beatmap",
            "Player",
            "Team",
            "Score",
            "Accuracy",
            "Combo",
            "Mods",
            "Match",
          ]
        : [
            "Map",
            "Team",
            "Player",
            "Score",
            "Accuracy",
            "Mods",
            "Team score",
            "Match",
          ];
    rows = plays.map((s) => ({
      Map: s.slot,
      Beatmap: s.title,
      Player: s.player,
      Team: s.team,
      Score: s.score,
      Accuracy: s.accuracy,
      Combo: s.combo,
      Mods: s.mods,
      Match: s.mp,
      "Team score": plays
        .filter((p) => p.game === s.game && p.team === s.team)
        .reduce((n, p) => n + p.score, 0),
    }));
  } else {
    columns = [
      view === 4 ? "Team" : "Player",
      "Average placement",
      "Average score",
      ...slots.flatMap((s) => [`${s} #`, `${s} Score`]),
    ];
    rows = keys.map((name) => {
      const p = plays.filter((s) => (view === 4 ? s.team : s.player) === name);
      const row: Row = {
        [columns[0]]: name,
        "Average placement": null,
        "Average score": avg(p, "score"),
      };
      if (view === 4) {
        const games = [...new Set(p.map((s) => s.game))];
        row["Average score"] = games.length
          ? p.reduce((n, s) => n + s.score, 0) / games.length
          : null;
      }
      const ranks: number[] = [];
      slots.forEach((slot) => {
        const matching = plays.filter((s) => s.slot === slot);
        const values = keys
          .map((k) => {
            const a = matching.filter(
              (s) => (view === 4 ? s.team : s.player) === k,
            );
            if (!a.length) return { name: k, value: null };
            const games = [...new Set(a.map((s) => s.game))];
            return {
              name: k,
              value:
                view === 4
                  ? Math.max(
                      ...games.map((g) =>
                        a
                          .filter((s) => s.game === g)
                          .reduce((n, s) => n + s.score, 0),
                      ),
                    )
                  : Math.max(...a.map((s) => s.score)),
            };
          })
          .filter((s) => s.value !== null)
          .sort((a, b) => b.value! - a.value!);
        const index = values.findIndex((s) => s.name === name);
        row[`${slot} #`] = index < 0 ? null : index + 1;
        row[`${slot} Score`] = index < 0 ? null : values[index].value;
        if (index >= 0) ranks.push(index + 1);
      });
      row["Average placement"] = ranks.length
        ? ranks.reduce((a, b) => a + b, 0) / ranks.length
        : null;
      return row;
    });
  }
  rows = rows.filter((row) =>
    Object.values(row).some((value) =>
      String(value ?? "")
        .toLowerCase()
        .includes(query.toLowerCase()),
    ),
  );
  rows.sort((a, b) => {
    const x = a[sort],
      y = b[sort];
    if (x == null) return 1;
    if (y == null) return -1;
    return (
      (typeof x === "number" && typeof y === "number"
        ? x - y
        : String(x).localeCompare(String(y))) * (descending ? -1 : 1)
    );
  });
  function cell(key: string, value: Cell) {
    if (value === null || value === undefined) return "—";
    if ((key === "Match" || key === "Team match") && typeof value === "number")
      return (
        <a
          href={`https://osu.ppy.sh/community/matches/${value}`}
          target="_blank"
          rel="noreferrer"
        >
          {value} ↗
        </a>
      );
    if (key === "Map ID" && typeof value === "number")
      return <a href={`https://osu.ppy.sh/b/${value}`}>{value} ↗</a>;
    if (typeof value === "number")
      return /accuracy|rate/i.test(key)
        ? `${number(value * 100, 2)}%`
        : number(value, /MC|placement/.test(key) ? 3 : 0);
    return value;
  }
  return (
    <section className="event-statistics">
      <h1>{tr("Statistics")}</h1>
      <div className="event-tabs">
        {views.map((label, i) => (
          <button
            key={label}
            aria-pressed={view === i}
            onClick={() => {
              setView(i);
              setSort(
                i === 1
                  ? "Map"
                  : i === 2
                    ? "Score"
                    : i === 3
                      ? "Team score"
                      : "Average score",
              );
            }}
          >
            {tr(label)}
          </button>
        ))}
      </div>
      <div className="event-tools">
        {[
          ["Rounds", round, setRound, [...new Set(scores.map((s) => s.round))]],
          ["Team", team, setTeam, [...new Set(scores.map((s) => s.team))]],
          ["Map", slot, setSlot, [...new Set(scores.map((s) => s.slot))]],
        ].map(([label, value, set, options]) => (
          <label key={label as string}>
            {tr(label as string)}
            <select
              value={value as string}
              onChange={(e) => (set as (v: string) => void)(e.target.value)}
            >
              <option value="">{tr("All")}</option>
              {(options as string[]).map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
        ))}
        <label>
          {tr("Search")}
          <input value={query} onChange={(e) => setQuery(e.target.value)} />
        </label>
      </div>
      <h2>{tr(views[view])}</h2>
      <div
        className="event-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr(views[view])}
      >
        <table className="event-table">
          <thead>
            <tr>
              <th scope="col">#</th>
              {columns.map((c) => (
                <th
                  scope="col"
                  key={c}
                  aria-sort={
                    sort === c
                      ? descending
                        ? "descending"
                        : "ascending"
                      : undefined
                  }
                >
                  <button
                    onClick={() => {
                      setSort(c);
                      setDescending(sort === c ? !descending : true);
                    }}
                  >
                    {c.includes(" #") ||
                    (c.includes(" Score") && c.match(/^[A-Z]+\d/))
                      ? c
                      : tr(c)}{" "}
                    {sort === c ? (descending ? "↓" : "↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                {columns.map((c) => (
                  <td key={c}>{cell(c, r[c])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
