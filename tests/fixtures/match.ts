import type { ScoringRules } from "../../src/lib/competition-model";
import type { MatchContext } from "../../src/lib/match-model";
// Representative synthetic API responses only. Not data from the organizer's example.
export const syntheticMatchId = 999001;
export const syntheticScoringRules: ScoringRules = {
  version: "synthetic-v1",
  mode: "osu",
  teamType: "team-vs",
  scoringType: "score",
  aggregation: "sum",
  playersPerTeam: 2,
  series: { type: "first_to", wins: 2 },
  allowSubstitutions: false,
  allowShortHanded: false,
  failedScorePolicy: "include",
  tiedMapPolicy: "require_replay",
};
export const syntheticMatchContext: MatchContext = {
  fixture: {
    id: "00000000-0000-4000-8000-000000000001",
    homeTeamId: "00000000-0000-4000-8000-000000000002",
    awayTeamId: "00000000-0000-4000-8000-000000000003",
    status: "scheduled",
  },
  round: { scoringRules: syntheticScoringRules },
  teams: [
    {
      id: "00000000-0000-4000-8000-000000000002",
      name: "Synthetic Home",
      members: [
        { osuId: 1001, username: "Synthetic Home A" },
        { osuId: 1002, username: "Synthetic Home B" },
      ],
    },
    {
      id: "00000000-0000-4000-8000-000000000003",
      name: "Synthetic Away",
      members: [
        { osuId: 2001, username: "Synthetic Away A" },
        { osuId: 2002, username: "Synthetic Away B" },
      ],
    },
  ],
  pool: null,
};
export function syntheticApiGame(id: number, homeScore = 200, awayScore = 100) {
  return {
    id,
    beatmap_id: 10000 + id,
    start_time: new Date(Date.UTC(2020, 0, 1, 0, id)).toISOString(),
    end_time: new Date(Date.UTC(2020, 0, 1, 0, id, 30)).toISOString(),
    mode: "osu",
    mode_int: 0,
    team_type: "team-vs",
    scoring_type: "score",
    mods: [] as string[],
    beatmap: {
      id: 10000 + id,
      beatmapset_id: 42,
      version: "Synthetic Difficulty",
      beatmapset: {
        id: 42,
        artist: "Synthetic Artist",
        title: `Synthetic Map ${id}`,
      },
    },
    scores: [1001, 1002, 2001, 2002].map((user_id, slot) => ({
      type: "legacy_match",
      user_id,
      legacy_total_score: slot < 2 ? homeScore : awayScore,
      total_score: slot < 2 ? homeScore : awayScore,
      accuracy: 0.98,
      max_combo: 100,
      passed: true,
      mods: [] as (string | { acronym: string })[],
      match: { team: slot < 2 ? "blue" : "red", slot, pass: true },
    })),
  };
}
export function syntheticEvent(id: number, game?: unknown) {
  return {
    id,
    timestamp: "2020-01-01T00:00:00Z",
    user_id: null,
    detail: { type: game ? "other" : "player-joined" },
    ...(game ? { game } : {}),
  };
}
export function syntheticPage(
  events: ReturnType<typeof syntheticEvent>[],
  overrides: Record<string, unknown> = {},
) {
  return {
    match: {
      id: syntheticMatchId,
      name: "Synthetic lobby title — never an OCLR team identity",
      start_time: "2020-01-01T00:00:00Z",
      end_time: "2020-01-01T23:59:00Z",
    },
    first_event_id: events[0]?.id ?? 0,
    latest_event_id: events.at(-1)?.id ?? 0,
    current_game_id: null,
    events,
    users: [
      {
        id: 1001,
        username: "Synthetic Provider",
        unrelated_profile: "DO_NOT_PERSIST_UNNECESSARY_PROFILE",
      },
    ],
    ...overrides,
  };
}
