import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { archiveBracket } from "../../src/lib/archive-bracket";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { historicalArchive } from "../fixtures/historical-archive";
const href = (id: string) => `/private-preview?section=matches&id=${id}`;
describe("historical schedule bracket", () => {
  it("includes only recorded matches and preserves private detail URLs", () => {
    const b = archiveBracket(historicalArchive, href)!;
    expect(
      b.groups.flatMap((g) => g.rounds.flatMap((r) => r.matches)),
    ).toMatchObject([
      { id: "one", scores: [6, 2], winnerSlot: 0, detailsUrl: href("one") },
    ]);
    expect(
      archiveBracket(
        {
          ...historicalArchive,
          matches: historicalArchive.matches.filter((m) => !m.score),
        },
        href,
      ),
    ).toBeNull();
  });
  it("connects previous appearances without declaring winner/loser progression", () => {
    const a = structuredClone(historicalArchive);
    a.matches.push({
      ...a.matches[0],
      id: "two",
      scheduledAt: "2023-12-11T22:00:00+08:00",
      score: [2, 6],
    });
    const b = archiveBracket(a, href)!;
    const rounds = b.groups[0].rounds;
    expect(rounds).toHaveLength(2);
    expect(rounds[1].matches[0].slots).toMatchObject([
      { teamId: "alpha", sourceMatchId: "one", kind: "team" },
      { teamId: "beta", sourceMatchId: "one", kind: "team" },
    ]);
    // Unknown dates do not imply an edge.
    a.matches[0].scheduledAt = null;
    expect(
      archiveBracket(a, href)!
        .groups.flatMap((g) => g.rounds.flatMap((r) => r.matches))
        .every((m) => m.slots.every((s) => s.sourceMatchId === null)),
    ).toBe(true);
  });
  it("does not choose among simultaneous source appearances", () => {
    const a = structuredClone(historicalArchive);
    a.matches.push(
      { ...a.matches[0], id: "simultaneous" },
      {
        ...a.matches[0],
        id: "later",
        scheduledAt: "2023-12-11T22:00:00+08:00",
      },
    );
    const later = archiveBracket(a, href)!
      .groups.flatMap((g) => g.rounds.flatMap((r) => r.matches))
      .find((m) => m.id === "later")!;
    expect(later.slots.every((s) => s.sourceMatchId === null)).toBe(true);
  });
  it("reconciles the S9 schedule, separates groups and omits six alternatives", () => {
    const a = historicalArchiveSchema.parse(
      JSON.parse(readFileSync("docs/imports/s9-archive.json", "utf8")),
    );
    const b = archiveBracket(a, href)!;
    expect(b.groups).toHaveLength(3);
    expect(b.groups[0].rounds).toHaveLength(5);
    const matches = b.groups.flatMap((g) => g.rounds.flatMap((r) => r.matches));
    expect(matches).toHaveLength(22);
    expect(new Set(matches.map((m) => m.id)).size).toBe(22);
    expect(matches.find((m) => m.id === "match-22")!.slots).toMatchObject([
      { teamId: "team-h", sourceMatchId: "match-17" },
      { teamId: "team-b", sourceMatchId: "match-21" },
    ]);
    const roundIndex = new Map(
      b.groups[0].rounds.flatMap((r, i) =>
        r.matches.map((m) => [m.id, i] as const),
      ),
    );
    for (const m of matches)
      for (const s of m.slots)
        if (s.sourceMatchId)
          expect(roundIndex.get(s.sourceMatchId)!).toBeLessThan(
            roundIndex.get(m.id)!,
          );
  });
});
