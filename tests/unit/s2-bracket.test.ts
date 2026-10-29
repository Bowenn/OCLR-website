import { expect, it } from "vitest";
import { completeS2Paths } from "../../src/lib/s2-bracket";
import { doubleBracketMatches } from "../../src/lib/double-bracket-adapter";
import type { ResolvedMatch } from "../../src/lib/bracket-model";
function fixture(): ResolvedMatch[] {
  return [
    ["a", "b"],
    ["c", "d"],
    ["e", "f"],
    ["g", "h"],
    ["h", "a"],
    ["f", "c"],
    ["e", "g"],
    ["h", "f"],
    ["g", "h"],
    ["e", "g"],
  ].map((teams, i) => ({
    id: `es-a${i + 1}`,
    label: `A${i + 1}`,
    status: "completed",
    scores: [6, 2],
    winnerSlot: 0,
    note: null,
    slots: teams.map((teamId) => ({
      teamId,
      label: teamId,
      kind: "team",
      sourceMatchId: null,
    })) as ResolvedMatch["slots"],
  }));
}
it("reconstructs all twelve S2 outcomes and produces a complete double bracket without dates", () => {
  const matches = fixture();
  completeS2Paths(matches);
  expect(
    matches.flatMap((m) => m.slots).filter((s) => s.sourceMatchId),
  ).toHaveLength(12);
  expect(matches[9].slots.map((s) => s.sourceMatchId)).toEqual([
    "es-a7",
    "es-a9",
  ]);
  const stages = [
    "败者",
    "败者",
    "胜者",
    "胜者",
    "败者",
    "败者",
    "胜者",
    "败者",
    "败者",
    "总决赛",
  ];
  expect(
    doubleBracketMatches({
      id: "s2",
      label: "S2",
      rounds: matches.map((m, i) => ({
        id: m.id,
        label: stages[i],
        matches: [m],
      })),
    }),
  ).not.toBeNull();
});
it("leaves incomplete, contradictory and drawn archives untouched", () => {
  for (const change of [
    (m: ResolvedMatch[]) => m.pop(),
    (m: ResolvedMatch[]) => {
      m[9].slots[0].teamId = "unknown";
    },
    (m: ResolvedMatch[]) => {
      m[3].winnerSlot = null;
    },
  ]) {
    const matches = fixture();
    change(matches);
    const before = structuredClone(matches);
    completeS2Paths(matches);
    expect(matches).toEqual(before);
  }
});
