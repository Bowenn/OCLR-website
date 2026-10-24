import { historicalArchive } from "./historical-archive";
import { syntheticApiGame } from "./match";
import type { HistoricalArchive } from "../../src/lib/historical-archive";
import type { MatchSource } from "../../src/lib/match-model";
export const statisticsArchive: HistoricalArchive = {
  ...structuredClone(historicalArchive),
  editionSlug: "s7",
  matches: [
    {
      ...historicalArchive.matches[0],
      score: [2, 0],
      mpUrls: ["https://osu.ppy.sh/community/matches/999177"],
    },
  ],
  pools: [
    {
      ...historicalArchive.pools[0],
      maps: [1, 2].map((id) => ({
        ...historicalArchive.pools[0].maps[0],
        slot: "NM" + id,
        beatmapId: 10000 + id,
        title: "Synthetic statistics map " + id,
      })),
    },
  ],
};
export function statisticsApiGames() {
  return [1, 2, 3, 4].map((id) => {
    const game = syntheticApiGame(id);
    if (id === 4) game.beatmap_id = 10001;
    game.beatmap.id = game.beatmap_id;
    const ids = [91001, 91003, 91002, 91004];
    return {
      ...game,
      scores: game.scores.map((s, i) => ({
        ...s,
        user_id: ids[i],
        accuracy: i < 2 ? 0.99 : 0.95,
        statistics: { count_300: 90, count_100: 5, count_50: 2, count_miss: 3 },
      })),
    };
  });
}
export function statisticsSource(): MatchSource {
  return {
    schemaVersion: 1,
    apiVersion: "20220705",
    fetchedAt: "2020-01-02T00:00:00Z",
    fingerprint: "a".repeat(64),
    match: {
      id: 999177,
      title: "Synthetic statistics lobby",
      startTime: "2020-01-01T00:00:00Z",
      endTime: "2020-01-01T01:00:00Z",
    },
    firstEventId: 1,
    latestEventId: 4,
    currentGameId: null,
    pages: 1,
    complete: true,
    warnings: [],
    events: [],
    games: statisticsApiGames().map((g) => ({
      id: g.id,
      beatmapId: g.beatmap_id,
      startTime: g.start_time,
      endTime: g.end_time,
      mode: "osu",
      teamType: "team-vs",
      scoringType: "score",
      mods: [],
      problems: [],
      beatmap: {
        setId: 42,
        artist: "Synthetic Artist",
        title: "Synthetic Game",
        difficulty: "Test",
      },
      scores: g.scores.map((s, i) => ({
        osuId: s.user_id,
        total: s.legacy_total_score,
        team: i < 2 ? "blue" : "red",
        slot: i,
        passed: true,
        mods: [],
        accuracy: s.accuracy,
        combo: 100,
        hitCounts: { great: 90, ok: 5, meh: 2, miss: 3 },
        problems: [],
        providerFields: {},
      })),
    })),
  };
}
