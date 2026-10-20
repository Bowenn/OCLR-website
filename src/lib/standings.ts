import type { PublicFixture, PublicTeam } from "./public-competition";
import type { StandingsRules } from "./competition-model";
export function calculateStandings(
  teams: PublicTeam[],
  fixtures: PublicFixture[],
  rulesByRound: ReadonlyMap<string, StandingsRules | null>,
) {
  const rows = teams.map((team) => ({
    team,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    mapsWon: 0,
    mapsLost: 0,
    mapDifference: 0,
    points: 0 as number | null,
    rank: null as number | null,
  }));
  const matches = fixtures.filter(
    (f) => f.stage === "group" && f.status !== "cancelled",
  );
  const policies = [...new Set(matches.map((f) => f.roundId))].map(
    (id) => rulesByRound.get(id) ?? null,
  );
  const criteria = policies.find((p) => p)?.tiebreakers ?? null;
  let pending =
    !matches.length ||
    !criteria ||
    policies.some(
      (p) => !p || JSON.stringify(p.tiebreakers) !== JSON.stringify(criteria),
    );
  for (const f of matches) {
    if (!f.result || !f.home.team || !f.away.team) continue;
    const h = rows.find((r) => r.team.id === f.home.team!.id);
    const a = rows.find((r) => r.team.id === f.away.team!.id);
    if (!h || !a) continue;
    h.played++;
    a.played++;
    h.mapsWon += f.result.homeWins;
    h.mapsLost += f.result.awayWins;
    a.mapsWon += f.result.awayWins;
    a.mapsLost += f.result.homeWins;
    const policy = rulesByRound.get(f.roundId);
    if (f.result.draw) {
      h.draws++;
      a.draws++;
      if (policy?.drawPoints === null || !policy) pending = true;
      else {
        h.points! += policy.drawPoints;
        a.points! += policy.drawPoints;
      }
    } else if (
      f.result.winnerTeamId === h.team.id ||
      f.result.winnerTeamId === a.team.id
    ) {
      const winner = f.result.winnerTeamId === h.team.id ? h : a;
      const loser = winner === h ? a : h;
      winner.wins++;
      loser.losses++;
      if (policy) {
        winner.points! += policy.winPoints;
        loser.points! += policy.lossPoints;
      } else pending = true;
    } else pending = true;
  }
  for (const row of rows) {
    row.mapDifference = row.mapsWon - row.mapsLost;
    if (pending) row.points = null;
  }
  const value = (
    row: (typeof rows)[number],
    key: NonNullable<typeof criteria>[number],
  ) =>
    key === "map_difference"
      ? row.mapDifference
      : key === "maps_won"
        ? row.mapsWon
        : key === "points"
          ? row.points!
          : row.wins;
  const compare = (a: (typeof rows)[number], b: (typeof rows)[number]) => {
    for (const key of criteria ?? []) {
      const diff = value(b, key) - value(a, key);
      if (diff) return diff;
    }
    return 0;
  };
  if (!pending) {
    rows.sort(compare);
    rows.forEach((r, i) => {
      r.rank =
        i > 0 && compare(rows[i - 1], r) === 0 ? rows[i - 1].rank : i + 1;
    });
  }
  return {
    rows,
    rankingPending: pending,
    criteria: pending ? null : criteria,
    rulesVersions: [
      ...new Set(policies.flatMap((p) => (p ? [p.version] : []))),
    ],
  };
}
