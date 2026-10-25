import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  approveArchiveMatches,
  publicHistoricalArchive,
  historicalArchiveSchema,
  archiveCounts,
  archiveWinner,
  recordedArchiveMatch,
} from "../../src/lib/historical-archive";
import { historicalArchive } from "../fixtures/historical-archive";
import { historicalSourceDetails } from "../fixtures/historical-source-details";
import { archiveEventMatches } from "../../src/lib/archive-event-matches";
import { archiveBracket } from "../../src/lib/archive-bracket";
describe("historical evidence validation", () => {
  it("approves a played draw without inventing a winner or exposing review evidence", () => {
    const pending = historicalSourceDetails();
    pending.matches = [pending.matches[0]];
    pending.matches[0].review!.workingScore = [5, 5];
    pending.matches[0].review!.rawScore = [5, 5];
    expect(publicHistoricalArchive(pending).matches).toEqual([]);
    expect(archiveWinner(pending.matches[0])).toBeNull();
    const approval = {
      approvedOn: "2026-10-26",
      source: "Synthetic organizer approval",
    };
    const approved = approveArchiveMatches(
      pending,
      [pending.matches[0].id],
      approval,
    );
    expect(approved.matches[0]).toMatchObject({
      score: [5, 5],
      review: { status: "approved", approval },
    });
    expect(approved.matches[0].review!.games).toEqual(
      pending.matches[0].review!.games,
    );
    expect(pending.matches[0].score).toBeNull();
    expect(recordedArchiveMatch(approved.matches[0])).toBe(true);
    expect(archiveCounts(approved)).toMatchObject({
      results: 1,
      incomplete: 0,
    });
    expect(archiveWinner(approved.matches[0])).toBeNull();
    const published = publicHistoricalArchive(approved);
    expect(published.matches[0].score).toEqual([5, 5]);
    expect(published.matches[0].review).toBeUndefined();
    expect(published.sourceFacts).toBeUndefined();
    expect(archiveWinner(published.matches[0])).toBeNull();
    expect(
      archiveEventMatches(
        published,
        published.matches,
        () => "/",
        "Asia/Shanghai",
        "en",
      )[0],
    ).toMatchObject({
      score: [5, 5],
      winner: null,
      recorded: true,
      forfeit: false,
    });
    expect(
      archiveBracket(published, () => "/")!.groups[0].rounds[0].matches[0],
    ).toMatchObject({ scores: [5, 5], winnerSlot: null, status: "completed" });
    expect(() =>
      approveArchiveMatches(approved, [pending.matches[0].id], approval),
    ).toThrow();
  });
  it("keeps final Tier evidence without inventing chronological draft selections", () => {
    const a = historicalArchiveSchema.parse({
      ...historicalArchive,
      draftMode: "final-tiers",
      picks: [],
    });
    expect(a.players[1].tier).toBe(historicalArchive.players[1].tier);
    expect(a.picks).toEqual([]);
    expect(
      historicalArchiveSchema.safeParse({
        ...a,
        picks: historicalArchive.picks,
      }).success,
    ).toBe(false);
    expect(
      historicalArchiveSchema.safeParse({ ...a, draftMode: undefined }).success,
    ).toBe(false);
  });
  it("records a forfeit winner without synthesizing a score or losing the result", () => {
    const a = historicalArchiveSchema.parse({
      ...historicalArchive,
      matches: [
        {
          ...historicalArchive.matches[0],
          score: null,
          mpUrls: [],
          forfeitWinner: 0,
        },
      ],
    });
    expect(recordedArchiveMatch(a.matches[0])).toBe(true);
    expect(archiveWinner(a.matches[0])).toBe(0);
    expect(archiveCounts(a)).toMatchObject({ results: 1, incomplete: 0 });
    expect(
      historicalArchiveSchema.safeParse({
        ...a,
        matches: [{ ...a.matches[0], score: [6, 0] }],
      }).success,
    ).toBe(false);
    expect(
      historicalArchiveSchema.safeParse({
        ...a,
        matches: [{ ...a.matches[0], forfeitWinner: 2 }],
      }).success,
    ).toBe(false);
    expect(
      historicalArchiveSchema.safeParse({
        ...a,
        matches: [{ ...a.matches[0], score: [0, -1] }],
      }).success,
    ).toBe(false);
    expect(archiveWinner(historicalArchive.matches[1])).toBeNull();
  });
  it("accepts literal ACE slots and staff names whose UID was not recorded", () => {
    const a = structuredClone(historicalArchive);
    a.pools[0].maps[0].slot = "ACE1";
    a.staff = [
      {
        osuId: null,
        username: "Historical signature",
        position: "Referee",
        source: "Staff!A1",
      },
    ];
    expect(historicalArchiveSchema.parse(a).staff[0].osuId).toBeNull();
    a.pools[0].maps[0].slot = "ACE0";
    expect(historicalArchiveSchema.safeParse(a).success).toBe(false);
  });
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
