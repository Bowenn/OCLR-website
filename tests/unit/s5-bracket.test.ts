import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { archiveBracket } from "../../src/lib/archive-bracket";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
import { doubleBracketMatches } from "../../src/lib/double-bracket-adapter";

function archive() {
  const saved = JSON.parse(
    readFileSync("docs/imports/s5-archive.json", "utf8"),
  );
  const source = JSON.parse(
    readFileSync("docs/imports/s5-source-records.json", "utf8"),
  );
  for (const match of saved.matches) {
    match.score = source.matches.find(
      (m: { id: string }) => m.id.toLowerCase() === match.id,
    ).score;
  }
  return historicalArchiveSchema.parse(saved);
}
it("reconciles all 34 S5 source scores, separating preliminaries and reconstructing twelve playoff edges", () => {
  const saved = archive();
  const before = structuredClone(saved);
  for (const url of [saved.sourceUrl, saved.sourceUrl.replace(/\/edit$/, "")]) {
    const bracket = archiveBracket(
      { ...saved, sourceUrl: url },
      (id) => `/matches/${id}`,
    )!;
    const group = bracket.groups.find((g) => g.layout === "grid")!;
    expect(group.rounds.flatMap((r) => r.matches)).toHaveLength(24);
    expect(
      group.rounds
        .flatMap((r) => r.matches.flatMap((m) => m.slots))
        .every((s) => s.sourceMatchId === null),
    ).toBe(true);
    const knockout = bracket.groups.find((g) => g.layout !== "grid")!;
    const matches = knockout.rounds.flatMap((r) => r.matches);
    expect(matches).toHaveLength(10);
    expect(
      matches.flatMap((m) => m.slots).filter((s) => s.sourceMatchId),
    ).toHaveLength(12);
    expect(
      matches.find((m) => m.id === "gf")!.slots.map((s) => s.sourceMatchId),
    ).toEqual(["wf", "lf"]);
    const diagram = doubleBracketMatches(knockout)!;
    expect(diagram).not.toBeNull();
    expect(diagram.upper.map((m) => m.id)).toEqual(["a25", "a26", "wf", "gf"]);
    expect(diagram.lower).toHaveLength(6);
    for (const match of matches)
      expect(match.scores).toEqual(
        saved.matches.find((m) => m.id === match.id)!.score,
      );
  }
  expect(saved).toEqual(before);
});
it("does not complete contradictory or incomplete S5 paths or unrelated workbooks", () => {
  for (const mutation of [
    (a: ReturnType<typeof archive>) => {
      a.matches = a.matches.filter((m) => m.id !== "b32");
    },
    (a: ReturnType<typeof archive>) => {
      a.matches.find((m) => m.id === "b32")!.score = [2, 6];
    },
    (a: ReturnType<typeof archive>) => {
      a.sourceUrl = "https://example.com/other";
    },
  ]) {
    const saved = archive();
    mutation(saved);
    const bracket = archiveBracket(saved, (id) => id)!;
    expect(
      bracket.groups
        .flatMap((g) => g.rounds.flatMap((r) => r.matches))
        .find((m) => m.id === "gf")!
        .slots.every((s) => s.sourceMatchId === null),
    ).toBe(true);
  }
});
