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
      expect(matches.every((m) => m.sourceRed === undefined)).toBe(true);
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

it("links verified pools within the edition and preserves unknown relationships", () => {
  const a = historicalArchiveSchema.parse(
    JSON.parse(readFileSync("docs/imports/s10-archive.json", "utf8")),
  );
  const rows = archiveEventMatches(a, a.matches, href, "Asia/Shanghai", "en");
  expect(rows.find((m) => m.id === "match-21")?.poolHref).toBe(
    href("mappools", "sf"),
  );
  expect(rows.find((m) => m.id === "match-1")?.poolHref).toBeUndefined();
  const explicit = { ...a.matches[0], poolId: "gs1" };
  expect(
    archiveEventMatches(a, [explicit], href, "Asia/Shanghai", "en")[0].poolHref,
  ).toBe(href("mappools", "gs1"));
  expect(
    historicalArchiveSchema.safeParse({
      ...a,
      matches: [{ ...explicit, poolId: "missing" }],
    }).success,
  ).toBe(false);
  expect(
    archiveEventMatches(
      { ...a, sourceUrl: "https://example.com/other" },
      a.matches,
      href,
      "Asia/Shanghai",
      "en",
    ).every((m) => m.poolHref === undefined),
  ).toBe(true);
  for (const season of [8, 9]) {
    const archive = historicalArchiveSchema.parse(
      JSON.parse(readFileSync(`docs/imports/s${season}-archive.json`, "utf8")),
    );
    expect(
      archiveEventMatches(
        archive,
        archive.matches,
        href,
        "Asia/Shanghai",
        "en",
      ).every((m) => m.poolHref),
    ).toBe(true);
  }
});
