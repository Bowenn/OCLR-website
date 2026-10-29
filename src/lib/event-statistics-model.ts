import type { EventScore } from "./event-statistics";

// A slot is only meaningful within its round and beatmap identity. Preview
// maps without numeric IDs retain their literal title as the identity fallback.
export type EventMapIdentity = Pick<
  EventScore,
  "round" | "slot" | "mapId" | "title"
>;
export function eventMapKey(score: EventMapIdentity) {
  return JSON.stringify([score.round, score.slot, score.mapId ?? score.title]);
}

export function groupEventMaps(scores: EventScore[]) {
  const maps = new Map<
    string,
    { key: string; label: string; plays: EventScore[] }
  >();
  for (const score of scores) {
    const key = eventMapKey(score);
    const map = maps.get(key);
    if (map) map.plays.push(score);
    else
      maps.set(key, {
        key,
        label: `${score.round} · ${score.slot} · ${score.mapId ?? score.title}`,
        plays: [score],
      });
  }
  return [...maps.values()];
}

// Scores already reflect the selected round/map scope. Team selection only
// controls visible rows; every participant in that scope remains a competitor.
export function eventPlacementRows(
  scores: EventScore[],
  by: "team" | "player",
  team = "",
) {
  const identity = by === "team" ? "teamId" : "osuId";
  const keys = [...new Set(scores.map((score) => score[identity]))].sort(
    (a, b) => String(a).localeCompare(String(b)),
  );
  const maps = groupEventMaps(scores);
  const visible = new Set(
    scores
      .filter((score) => !team || score.teamId === team)
      .map((score) => score[identity]),
  );
  return keys
    .map((id) => {
      const plays = scores.filter((score) => score[identity] === id);
      const name = plays.map((score) => score[by]).sort()[0];
      const row: Record<string, string | number | null> = {
        _identity: id,
        ...(by === "player" ? { _osuId: id } : { _teamId: id }),
        [by === "team" ? "Team" : "Player"]: name,
        "Average placement": null,
        "Average score":
          plays.reduce((total, score) => total + score.score, 0) /
          (by === "team"
            ? new Set(plays.map((score) => eventGameKey(score))).size
            : plays.length),
      };
      const ranks: number[] = [];
      for (const map of maps) {
        const values = keys
          .map((key) => {
            const matching = map.plays.filter(
              (score) => score[identity] === key,
            );
            if (!matching.length) return { name: key, value: null };
            const games = [...new Set(matching.map(eventGameKey))];
            return {
              name: key,
              value:
                by === "team"
                  ? Math.max(
                      ...games.map((game) =>
                        matching
                          .filter((score) => eventGameKey(score) === game)
                          .reduce((total, score) => total + score.score, 0),
                      ),
                    )
                  : Math.max(...matching.map((score) => score.score)),
            };
          })
          .filter((value) => value.value !== null)
          .sort((a, b) => b.value! - a.value!);
        const index = values.findIndex((value) => value.name === id);
        // Competition ranking, matching standings: equal scores share a rank
        // and the next rank skips tied competitors (1, 1, 3).
        const rank =
          index < 0
            ? null
            : values.findIndex((value) => value.value === values[index].value) +
              1;
        row[`${map.key}:rank`] = rank;
        row[`${map.key}:score`] = index < 0 ? null : values[index].value;
        if (rank !== null) ranks.push(rank);
      }
      row["Average placement"] = ranks.length
        ? ranks.reduce((total, rank) => total + rank, 0) / ranks.length
        : null;
      return row;
    })
    .filter((row) => visible.has(row._identity as string | number));
}

export function eventGameKey(score: Pick<EventScore, "fixture" | "game">) {
  return JSON.stringify([score.fixture, score.game]);
}
/** Team/game identity never depends on display names or delimiter concatenation. */
export function eventTeamGames(plays: EventScore[]) {
  const groups = new Map<string, EventScore[]>();
  for (const score of plays) {
    const key = JSON.stringify([score.fixture, score.game, score.teamId]);
    groups.set(key, [...(groups.get(key) ?? []), score]);
  }
  return [...groups]
    .map(([key, scores]) => ({
      key,
      teamId: scores[0].teamId,
      name: scores.map((s) => s.team).sort()[0],
      total: scores.reduce((sum, score) => sum + score.score, 0),
      mp: scores[0].mp,
    }))
    .sort((a, b) => b.total - a.total || a.key.localeCompare(b.key));
}
