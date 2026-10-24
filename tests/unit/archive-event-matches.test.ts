import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { archiveEventMatches } from "../../src/lib/archive-event-matches";
import {
  historicalArchiveSchema,
  recordedArchiveMatch,
} from "../../src/lib/historical-archive";
import { historicalArchive } from "../fixtures/historical-archive";

const href = (section: string, id?: string) =>
  `/tournaments/history/${section}/${id}`;
describe("historical schedule adapter", () => {
  for (const season of [7, 8, 9, 10])
    it(`preserves S${season} published evidence`, () => {
      const archive = historicalArchiveSchema.parse(
        JSON.parse(
          readFileSync(`docs/imports/s${season}-archive.json`, "utf8"),
        ),
      );
      const source = archive.matches.filter(recordedArchiveMatch);
      const matches = archiveEventMatches(
        archive,
        source,
        href,
        "Asia/Shanghai",
        "en",
      );
      expect(matches).toHaveLength(source.length);
      expect(matches.map((m) => m.stage)).toEqual(source.map((m) => m.stage));
      expect(matches.map((m) => m.score)).toEqual(source.map((m) => m.score));
      expect(matches.map((m) => m.mps)).toEqual(source.map((m) => m.mpUrls));
      expect(
        matches.every((m) => m.sourceRed === undefined && m.pool === "—"),
      ).toBe(true);
      if (season === 10) expect(matches).toHaveLength(30);
    });
  it("keeps forfeits, multiple rooms, time zone and preview links without altering records", () => {
    const source = {
      ...historicalArchive.matches[0],
      score: null,
      forfeitWinner: 1 as const,
      mpUrls: ["https://osu.ppy.sh/mp/123", "https://osu.ppy.sh/mp/456"],
    };
    const matches = archiveEventMatches(
      historicalArchive,
      [source],
      (s, id) => `/preview?section=${s}&id=${id}`,
      "Asia/Shanghai",
      "en",
    );
    expect(matches[0]).toMatchObject({
      winner: 1,
      forfeit: true,
      score: null,
      mps: source.mpUrls,
      href: "/preview?section=matches&id=one",
      redHref: "/preview?section=teams&id=alpha",
    });
    expect(matches[0].time).toContain("UTC+8");
    expect(source.score).toBeNull();
  });
});
