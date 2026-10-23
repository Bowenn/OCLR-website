import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { deriveS8Standings } from "../../src/lib/s8-standings";
const source = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s8-archive.json", "utf8")),
);
describe("derived S8 group standings", () => {
  it("reconciles 16 teams and 24 matches without rewriting evidence", () => {
    const before = JSON.stringify(source);
    const rows = deriveS8Standings(source);
    expect(rows).toHaveLength(16);
    for (const row of rows) {
      const original = source.standings.find((s) => s.teamId === row.teamId)!;
      expect(row).toMatchObject({
        played: 3,
        wins: original.wins,
        losses: original.losses,
        mapsWon: original.mapsWon,
        mapsLost: original.mapsLost,
        status: "complete",
      });
      expect(row.mapDifference).toBe(original.mapsWon! - original.mapsLost!);
      expect(row.rank).not.toBeNull();
    }
    expect(
      rows
        .filter((r) => r.group === "B")
        .map((r) => [r.wins, r.mapDifference, r.rank]),
    ).toEqual([
      [3, 9, 1],
      [1, 1, 2],
      [1, -1, 3],
      [1, -9, 4],
    ]);
    expect(JSON.stringify(source)).toBe(before);
    const shuffled = structuredClone(source);
    shuffled.matches.reverse();
    shuffled.standings.reverse();
    shuffled.teams.reverse();
    expect(deriveS8Standings(shuffled)).toEqual(rows);
  });
  it("keeps genuinely equal values tied with competition ranks", () => {
    const a = structuredClone(source);
    // Every pair is recorded, with a three-way cycle behind the undefeated team.
    const group = a.standings
      .filter((s) => s.group === "A")
      .map((s) => s.teamId);
    a.matches = a.matches.filter((m) => m.stage !== "Group A");
    for (let i = 0; i < 4; i++)
      for (let j = i + 1; j < 4; j++)
        a.matches.push({
          ...source.matches[0],
          id: `synthetic-${i}-${j}`,
          stage: "Group A",
          teamA: group[i],
          teamB: group[j],
          score:
            i === 0 || (i === 1 && j === 2) || (i === 2 && j === 3)
              ? [6, 0]
              : [0, 6],
        });
    expect(
      deriveS8Standings(a)
        .filter((r) => r.group === "A")
        .map((r) => [r.rank, r.tied]),
    ).toEqual([
      [1, false],
      [2, true],
      [2, true],
      [2, true],
    ]);
  });
  it.each([
    "missing",
    "unscored",
    "duplicate",
    "membership",
    "wrong-group",
    "draw",
  ])("withholds all group ranks for %s evidence", (kind) => {
    const a = structuredClone(source);
    const m = a.matches.find((m) => m.stage === "Group A")!;
    if (kind === "missing") a.matches = a.matches.filter((x) => x !== m);
    if (kind === "unscored") m.score = null;
    if (kind === "duplicate") a.matches.push({ ...m, id: "duplicate" });
    if (kind === "membership")
      a.standings.push({ ...a.standings[0], group: "B" });
    if (kind === "wrong-group")
      m.teamA = a.standings.find((s) => s.group === "B")!.teamId;
    if (kind === "draw") m.score = [0, 0];
    const rows = deriveS8Standings(a).filter((r) => r.group === "A");
    expect(rows.every((r) => r.rank === null && r.status !== "complete")).toBe(
      true,
    );
  });
});
