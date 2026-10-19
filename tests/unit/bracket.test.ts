import { expect, it } from "vitest";
import { bracketFixture } from "../fixtures/bracket";
import { bracketsSchema, resolveBracket } from "../../src/lib/bracket-model";
const a = "11111111-1111-4111-8111-111111111111";
const b = "22222222-2222-4222-8222-222222222222";
const teams = [
  { id: a, name: "Synthetic Team A" },
  { id: b, name: "Synthetic Team B" },
];
it("resolves supplied winners and losers without inventing scores", () => {
  const data = bracketsSchema.parse([bracketFixture("test-cup", a, b)])[0];
  const resolved = resolveBracket(data, teams);
  expect(
    resolved.groups[0].rounds[1].matches[0].slots.map((s) => s.teamId),
  ).toEqual([a, b]);
  expect(resolved.groups[0].rounds[1].matches[0].scores).toEqual([null, null]);
});
it("rejects cycles, unknown sources and duplicate match IDs", () => {
  for (const issue of ["cycle", "unknown", "duplicate"]) {
    const data = bracketFixture("test-cup", a, b);
    if (issue === "duplicate")
      data.groups[0].rounds[1].matches[0].id = "match-one";
    else
      data.groups[0].rounds[0].matches[0].slots[0] = {
        type: "winner",
        matchId: issue === "cycle" ? "match-two" : "unknown",
      };
    expect(bracketsSchema.safeParse([data]).success).toBe(false);
  }
});
it("rejects unpublished team identities and inconsistent winners while supporting reviewed exceptions", () => {
  const data = bracketFixture("test-cup", a, b);
  expect(() => resolveBracket(data, teams.slice(0, 1))).toThrow("unpublished");
  data.groups[0].rounds[0].matches[0].winnerSlot = 1;
  expect(() => resolveBracket(data, teams)).toThrow("score exception");
  data.groups[0].rounds[0].matches[0].note =
    "Synthetic adjudicated result fixture";
  expect(() => resolveBracket(data, teams)).not.toThrow();
});
it("represents byes and unresolved future matches explicitly", () => {
  const data = bracketFixture("test-cup", a, b);
  const first = data.groups[0].rounds[0].matches[0];
  first.slots[1] = { type: "bye" };
  first.scores = [null, null];
  const resolved = resolveBracket(data, teams);
  expect(resolved.groups[0].rounds[0].matches[0].slots[1].label).toBe("Bye");
  expect(resolved.groups[0].rounds[1].matches[0].slots[1].teamId).toBeNull();
});
