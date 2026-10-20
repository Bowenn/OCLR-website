import { describe, expect, it } from "vitest";
import { calculateStandings } from "../../src/lib/standings";
import type {
  PublicFixture,
  PublicMatchResult,
} from "../../src/lib/public-competition";
import type { StandingsRules } from "../../src/lib/competition-model";
const teams = [
  { id: "a", name: "Z team" },
  { id: "b", name: "A team" },
  { id: "c", name: "C team" },
];
const rules: StandingsRules = {
  version: "synthetic-points",
  winPoints: 3,
  lossPoints: 0,
  drawPoints: 1,
  tiebreakers: ["points", "map_difference"],
};
function fixture(
  homeWins: number,
  awayWins: number,
  draw = false,
): PublicFixture {
  const result: PublicMatchResult = {
    revision: 1,
    homeWins,
    awayWins,
    tiedMaps: 0,
    winnerTeamId: draw ? null : homeWins > awayWins ? "a" : "b",
    draw,
    games: [],
    mpId: 999001,
    mpUrl: "https://osu.ppy.sh/community/matches/999001",
    publicNote: "Synthetic note",
    updatedAt: "2020-01-01T00:00:00Z",
  };
  return {
    pool: null,
    id: "f",
    label: "Synthetic match",
    publishedAt: "2020-01-01T00:00:00Z",
    roundId: "r",
    roundName: "Synthetic round",
    roundPosition: 1,
    stageId: "stage",
    stage: "group",
    position: 1,
    home: {
      team: teams[0],
      label: teams[0].name,
      sourceId: null,
      outcome: null,
    },
    away: {
      team: teams[1],
      label: teams[1].name,
      sourceId: null,
      outcome: null,
    },
    confirmed: true,
    scheduledAt: null,
    timeZone: "UTC",
    status: "scheduled",
    result,
    updatedAt: "2020-01-01T00:00:00Z",
  };
}
describe("explicit group standings policies", () => {
  it("keeps ranks and points pending without approved rules while retaining factual map statistics", () => {
    const table = calculateStandings(teams, [fixture(2, 1)], new Map());
    expect(table.rankingPending).toBe(true);
    expect(table.rows.every((r) => r.rank === null && r.points === null)).toBe(
      true,
    );
    expect(table.rows[0]).toMatchObject({
      played: 1,
      wins: 1,
      losses: 0,
      mapsWon: 2,
      mapsLost: 1,
      mapDifference: 1,
    });
  });
  it("applies configured points and leaves unresolved equal ranks tied without alphabetical tiebreaks", () => {
    const match = fixture(1, 1, true);
    const table = calculateStandings(teams, [match], new Map([["r", rules]]));
    expect(table.rankingPending).toBe(false);
    expect(table.rows.map((r) => [r.team.id, r.rank, r.points])).toEqual([
      ["a", 1, 1],
      ["b", 1, 1],
      ["c", 3, 0],
    ]);
  });
  it("does not guess draw points or combine inconsistent ordered tiebreakers", () => {
    expect(
      calculateStandings(
        teams,
        [fixture(1, 1, true)],
        new Map([["r", { ...rules, drawPoints: null }]]),
      ).rankingPending,
    ).toBe(true);
    expect(
      calculateStandings(
        teams,
        [fixture(2, 1), { ...fixture(1, 2), roundId: "r2" }],
        new Map([
          ["r", rules],
          ["r2", { ...rules, tiebreakers: ["wins"] }],
        ]),
      ).rankingPending,
    ).toBe(true);
  });
  it("ignores knockout, cancelled and unpublished results and does not derive forfeits from notes", () => {
    const match = fixture(2, 0);
    match.result!.publicNote = "Synthetic forfeit text is not a result policy";
    const table = calculateStandings(
      teams,
      [
        { ...match, stage: "knockout" },
        { ...match, status: "cancelled" },
        { ...match, result: null },
      ],
      new Map([["r", rules]]),
    );
    expect(table.rows.every((r) => r.played === 0 && r.wins === 0)).toBe(true);
  });
  it("ranks only the configured member teams and does not fabricate a winner for an unresolved outcome", () => {
    const match = fixture(2, 1);
    match.result!.winnerTeamId = null;
    expect(
      calculateStandings(teams, [match], new Map([["r", rules]]))
        .rankingPending,
    ).toBe(true);
    expect(
      calculateStandings([teams[2]], [fixture(2, 1)], new Map([["r", rules]]))
        .rows[0].played,
    ).toBe(0);
  });
});
