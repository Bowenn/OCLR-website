import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  statisticsArchive as a,
  statisticsSource,
} from "../fixtures/archive-statistics";
import { statisticsArchiveKey } from "../../src/lib/archive-statistics";
import {
  aggregateStatistics,
  fixtureStatisticsIssues,
  statisticsGameIssues,
  projectStatistics,
  statisticsFixtures,
  suggestStatisticsPool,
  type StatisticsSnapshot,
} from "../../src/lib/archive-statistics-model";
const snapshot = (): StatisticsSnapshot => ({
  source: statisticsSource(),
  archiveKey: statisticsArchiveKey(a),
  poolId: "final",
  included: [1, 2],
});
describe("historical MP statistics", () => {
  it("requires explicit review for missing historical pools and preserves MP metadata", () => {
    const s = snapshot();
    s.poolId = "";
    expect(fixtureStatisticsIssues(a, "one", [s])).toContain(
      "Select the recorded mappool.",
    );
    s.allowUnlistedMaps = true;
    expect(fixtureStatisticsIssues(a, "one", [s])).toEqual([]);
    expect(projectStatistics(a, "one", s)[0]).toMatchObject({
      slot: "—",
      title: "Synthetic Artist - Synthetic Game - Test",
      scoringType: "score",
    });
  });
  it("covers the actual S7–S10 MP inventory and omits forfeits and unplayed records", () => {
    for (const slug of ["s7", "s8", "s9", "s10"]) {
      const archive = JSON.parse(
        readFileSync("docs/imports/" + slug + "-archive.json", "utf8"),
      );
      const fixtures = statisticsFixtures(archive);
      expect(fixtures.length).toBeGreaterThan(20);
      expect(
        fixtures.every(
          (f) => f.score && f.mpUrls.length && f.forfeitWinner === undefined,
        ),
      ).toBe(true);
    }
  });
  it("reconciles reviewed games and rejects warmups, replays and partial MP coverage", () => {
    expect(fixtureStatisticsIssues(a, "one", [snapshot()])).toEqual([]);
    const s = snapshot();
    s.included.push(3);
    expect(fixtureStatisticsIssues(a, "one", [s])).toContain(
      "Beatmap is outside the selected mappool.",
    );
    s.included = [1, 4];
    expect(fixtureStatisticsIssues(a, "one", [s])).toContain(
      "Exclude duplicate games and replayed beatmaps.",
    );
    expect(fixtureStatisticsIssues(a, "one", [])).toContain(
      "Import every recorded MP link before publishing this match.",
    );
    s.included = [];
    expect(fixtureStatisticsIssues(a, "one", [s])).toContain(
      "Selected games do not reconcile with the recorded series score.",
    );
  });
  it("rejects unknown identities, colors, unfinished games and unsupported scoring", () => {
    const g = statisticsSource().games[0];
    g.scores[0].osuId = 123;
    expect(statisticsGameIssues(a, "one", "final", g)).toContain(
      "A score cannot be matched to the recorded roster.",
    );
    g.scores[0].osuId = 91001;
    g.scores[0].team = "red";
    expect(statisticsGameIssues(a, "one", "final", g)).toContain(
      "Team colors do not identify both recorded teams.",
    );
    g.endTime = null;
    g.scoringType = "combo";
    expect(statisticsGameIssues(a, "one", "final", g)).toContain(
      "Game is unfinished or uses unsupported rules.",
    );
  });
  it("aggregates by UID with honest missing values, failures and zero-score games", () => {
    const plays = projectStatistics(a, "one", snapshot());
    plays[0].accuracy = null;
    plays[0].passed = false;
    plays[0].hits = undefined;
    const rows = aggregateStatistics(a, plays);
    expect(rows.find((r) => r.osuId === 91001)).toMatchObject({
      maps: 2,
      matches: 1,
      total: 400,
      mean: 200,
      relative: 1,
      accuracy: 0.99,
      accuracyMaps: 1,
      passRate: 0.5,
      misses: null,
    });
    const empty = aggregateStatistics(a, []).find((r) => r.osuId === 91001)!;
    expect(empty).toMatchObject({
      maps: 0,
      total: null,
      relative: null,
      accuracy: null,
      combo: null,
      misses: null,
    });
    const s = snapshot();
    s.source.games[0].scores.forEach((p) => {
      p.total = 0;
    });
    expect(projectStatistics(a, "one", s)[0].relative).toBeNull();
  });
  it("selects the closest recorded pool and keys competition changes but not staff corrections", () => {
    expect(suggestStatisticsPool(a, statisticsSource())).toBe("final");
    const clone = structuredClone(a);
    clone.staff = [];
    clone.notes = [];
    expect(statisticsArchiveKey(clone)).toBe(statisticsArchiveKey(a));
    clone.matches[0].score = [3, 0];
    expect(statisticsArchiveKey(clone)).not.toBe(statisticsArchiveKey(a));
  });
});
