import { expect, it } from "vitest";
import { archiveBracket } from "../../src/lib/archive-bracket";
import { doubleBracketMatches } from "../../src/lib/double-bracket-adapter";
import { s3BracketFixture } from "../fixtures/s3-bracket";
it("separates two S3 groups and reconstructs twelve paths with no reset or dates", () => {
  const a = s3BracketFixture(),
    before = structuredClone(a);
  for (const suffix of ["", "/edit"]) {
    const b = archiveBracket(
      { ...a, sourceUrl: a.sourceUrl + suffix },
      (id) => id,
    )!;
    expect(
      b.groups
        .filter((g) => g.layout === "grid")
        .map((g) => g.rounds.flatMap((r) => r.matches).length),
    ).toEqual([10, 10]);
    const group = b.groups[0],
      matches = group.rounds.flatMap((r) => r.matches);
    expect(matches).toHaveLength(10);
    expect(
      matches.flatMap((m) => m.slots).filter((s) => s.sourceMatchId),
    ).toHaveLength(12);
    expect(
      matches.find((m) => m.id === "ko-a10")!.slots.map((s) => s.sourceMatchId),
    ).toEqual(["ko-a5", "ko-b9"]);
    expect(doubleBracketMatches(group)?.lower).toHaveLength(6);
    expect(matches.find((m) => m.id === "ko-a10")!.winnerSlot).toBe(1);
  }
  expect(a).toEqual(before);
});
it("does not reconstruct incomplete, contradictory, drawn or unrelated data", () => {
  for (const change of [
    (a: ReturnType<typeof s3BracketFixture>) => {
      a.matches = a.matches.filter((m) => m.id !== "ko-b8");
    },
    (a: ReturnType<typeof s3BracketFixture>) => {
      a.matches.find((m) => m.id === "ko-b8")!.score = [6, 5];
    },
    (a: ReturnType<typeof s3BracketFixture>) => {
      a.matches.find((m) => m.id === "ko-b8")!.score = [5, 5];
    },
    (a: ReturnType<typeof s3BracketFixture>) => {
      a.sourceUrl = "https://example.com/other";
    },
  ]) {
    const a = s3BracketFixture();
    change(a);
    const b = archiveBracket(a, (id) => id)!;
    expect(
      b.groups
        .flatMap((g) => g.rounds.flatMap((r) => r.matches))
        .flatMap((m) => m.slots)
        .every((s) => s.sourceMatchId === null),
    ).toBe(true);
  }
});
