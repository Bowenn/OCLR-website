import type { HistoricalArchive } from "./historical-archive";
export type DerivedStanding = {
  group: string;
  teamId: string;
  rank: number | null;
  tied: boolean;
  played: number;
  wins: number;
  losses: number;
  mapsWon: number;
  mapsLost: number;
  mapDifference: number;
  status: "complete" | "incomplete" | "review";
};
/** Derived order only: wins, then map difference. No official S8 tiebreak is documented. */
export function deriveS8Standings(
  archive: HistoricalArchive,
): DerivedStanding[] {
  const membership = new Map<string, string[]>();
  for (const s of archive.standings)
    membership.set(s.teamId, [...(membership.get(s.teamId) ?? []), s.group]);
  return [...new Set(archive.standings.map((s) => s.group))]
    .sort()
    .flatMap((group) => {
      const ids = [
        ...new Set(
          archive.standings
            .filter((s) => s.group === group)
            .map((s) => s.teamId),
        ),
      ];
      let review =
        ids.length !== 4 ||
        ids.some(
          (id) =>
            membership.get(id)!.length !== 1 ||
            !archive.teams.some((t) => t.id === id),
        );
      let incomplete = false;
      const rows = new Map(
        ids.map((teamId) => [
          teamId,
          {
            group,
            teamId,
            rank: null,
            tied: false,
            played: 0,
            wins: 0,
            losses: 0,
            mapsWon: 0,
            mapsLost: 0,
            mapDifference: 0,
            status: "complete",
          } as DerivedStanding,
        ]),
      );
      const pairs = new Map<string, HistoricalArchive["matches"]>();
      for (const match of archive.matches) {
        if (!/^Group\s+/i.test(match.stage)) continue;
        const stageGroup = match.stage.replace(/^Group\s+/i, "");
        const involved = ids.includes(match.teamA) || ids.includes(match.teamB);
        if (stageGroup !== group) {
          if (involved) review = true;
          continue;
        }
        if (
          !rows.has(match.teamA) ||
          !rows.has(match.teamB) ||
          match.teamA === match.teamB
        ) {
          review = true;
          continue;
        }
        const key = [match.teamA, match.teamB].sort().join(":");
        pairs.set(key, [...(pairs.get(key) ?? []), match]);
      }
      for (let i = 0; i < ids.length; i++)
        for (let j = i + 1; j < ids.length; j++) {
          const matches = pairs.get([ids[i], ids[j]].sort().join(":")) ?? [];
          if (matches.length > 1) {
            review = true;
            continue;
          }
          if (matches.length === 0 || !matches[0].score) {
            incomplete = true;
            continue;
          }
          const m = matches[0],
            score = m.score!;
          if (
            score[0] === score[1] ||
            score.some((v) => !Number.isSafeInteger(v) || v < 0)
          ) {
            review = true;
            continue;
          }
          for (const [index, id] of [m.teamA, m.teamB].entries()) {
            const r = rows.get(id)!;
            r.played++;
            r.mapsWon += score[index];
            r.mapsLost += score[1 - index];
            if (score[index] > score[1 - index]) r.wins++;
            else r.losses++;
            r.mapDifference = r.mapsWon - r.mapsLost;
          }
        }
      const sorted = [...rows.values()].sort(
        (a, b) =>
          b.wins - a.wins ||
          b.mapDifference - a.mapDifference ||
          a.teamId.localeCompare(b.teamId),
      );
      for (const row of sorted) {
        row.status = review ? "review" : incomplete ? "incomplete" : "complete";
        if (row.status !== "complete") continue;
        row.rank =
          1 +
          sorted.filter(
            (other) =>
              other.wins > row.wins ||
              (other.wins === row.wins &&
                other.mapDifference > row.mapDifference),
          ).length;
        row.tied = sorted.some(
          (other) =>
            other !== row &&
            other.wins === row.wins &&
            other.mapDifference === row.mapDifference,
        );
      }
      return sorted;
    });
}
