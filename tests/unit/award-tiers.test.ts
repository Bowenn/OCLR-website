import { describe, it, expect } from "vitest";
import { draftAwardTiers } from "../../src/lib/award-tiers";
import { generateTurnSequence } from "../../src/lib/draft-order";
describe("authoritative draft award tiers", () => {
  it.each(["snake", "forward"] as const)(
    "uses rounds rather than overall order in %s",
    (mode) => {
      const sequence = generateTurnSequence(["A", "B", "C"], 6, mode);
      const picks = sequence.map((teamId, turnIndex) => ({
        teamId,
        turnIndex,
        playerId: turnIndex + 1,
      }));
      expect(draftAwardTiers(sequence, picks, [1])).toEqual(
        picks
          .slice(1)
          .map((p) => ({
            userId: p.playerId,
            tier: Math.floor(p.turnIndex / 3) + 1,
          })),
      );
      expect(
        draftAwardTiers(
          sequence,
          picks.filter((p) => p.playerId !== 10),
          [1],
        ).some((p) => p.userId === 10),
      ).toBe(false);
    },
  );
  it("does not guess absent, mismatched, duplicate or irregular custom rounds", () => {
    expect(draftAwardTiers([], [], [])).toEqual([]);
    expect(
      draftAwardTiers(
        ["A", "A", "B"],
        [{ teamId: "A", turnIndex: 1, playerId: 1 }],
        [],
      ),
    ).toEqual([]);
    expect(
      draftAwardTiers(
        ["A", "B"],
        [{ teamId: "B", turnIndex: 0, playerId: 1 }],
        [],
      ),
    ).toEqual([]);
    expect(
      draftAwardTiers(
        ["A", "B"],
        [
          { teamId: "A", turnIndex: 0, playerId: 1 },
          { teamId: "B", turnIndex: 1, playerId: 1 },
        ],
        [],
      ),
    ).toEqual([]);
  });
});
