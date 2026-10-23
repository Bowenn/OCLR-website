import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  historicalArchiveSchema,
  archiveCounts,
} from "../../src/lib/historical-archive";
import { historicalArchive } from "../fixtures/historical-archive";
describe("historical evidence validation", () => {
  it("preserves missing results, conflict fields and captain identity", () => {
    const a = historicalArchiveSchema.parse(historicalArchive);
    expect(archiveCounts(a)).toMatchObject({
      results: 1,
      incomplete: 1,
      maps: 2,
    });
    expect(a.players[0].tier).toBe(0);
    expect(a.pools[0].maps[1].beatmapId).toBeNull();
  });
  it.each([
    (a: typeof historicalArchive) => {
      a.players.push(a.players[0]);
    },
    (a: typeof historicalArchive) => {
      a.picks[0].round = 2;
    },
    (a: typeof historicalArchive) => {
      a.picks = [];
    },
    (a: typeof historicalArchive) => {
      a.matches[0].teamA = "unknown";
    },
    (a: typeof historicalArchive) => {
      a.matches[0].score = [0, 0];
    },
    (a: typeof historicalArchive) => {
      a.sourceUrl = "javascript:alert(1)";
    },
    (a: typeof historicalArchive) => {
      a.sourceUrl = "malformed";
    },
    (a: typeof historicalArchive) => {
      a.links[0].url = "https://user:password@example.com";
    },
    (a: typeof historicalArchive) => {
      a.players[0].tier = null;
    },
    (a: typeof historicalArchive) => {
      a.pools[0].maps.push(a.pools[0].maps[0]);
    },
  ])("rejects ambiguous or invalid source records", (mutate) => {
    const a = structuredClone(historicalArchive);
    mutate(a);
    expect(historicalArchiveSchema.safeParse(a).success).toBe(false);
  });
  it("rejects extra private fields rather than passing them to public pages", () => {
    const a = structuredClone(historicalArchive);
    expect(
      historicalArchiveSchema.safeParse({
        ...a,
        answers: { private: "never publish" },
      }).success,
    ).toBe(false);
    expect(
      historicalArchiveSchema.safeParse({
        ...a,
        players: [{ ...a.players[0], contact: "private" }],
      }).success,
    ).toBe(false);
  });
  it("validates the prepared S9 package and reconciles all group scores", () => {
    const a = historicalArchiveSchema.parse(
      JSON.parse(readFileSync("docs/imports/s9-archive.json", "utf8")),
    );
    expect(archiveCounts(a)).toEqual({
      teams: 8,
      players: 76,
      picks: 56,
      results: 22,
      incomplete: 6,
      pools: 4,
      maps: 76,
    });
    for (const s of a.standings) {
      const results = a.matches
        .filter(
          (m) =>
            m.stage === `Group ${s.group}` &&
            [m.teamA, m.teamB].includes(s.teamId),
        )
        .map((m) =>
          m.teamA === s.teamId ? m.score! : [...m.score!].reverse(),
        );
      expect([
        results.filter(([a, b]) => a > b).length,
        results.filter(([a, b]) => a < b).length,
        results.reduce((n, [a]) => n + a, 0),
        results.reduce((n, [, b]) => n + b, 0),
      ]).toEqual([s.wins, s.losses, s.mapsWon, s.mapsLost]);
    }
  });
});
