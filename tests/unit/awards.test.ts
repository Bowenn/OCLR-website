import { describe, it, expect } from "vitest";
import {
  weeklyStandings,
  awardConfigurationSchema,
  awardPercentage,
  type AwardGame,
} from "../../src/lib/award-model";
const weeks = [1, 2, 3].map((number) => ({
  number,
  startsAt: `2026-10-${String(number * 7).padStart(2, "0")}T00:00:00Z`,
  endsAt: `2026-10-${String(number * 7 + 7).padStart(2, "0")}T00:00:00Z`,
}));
const game = (
  id: number,
  week: number,
  scores = [
    { userId: 1, total: 50 },
    { userId: 2, total: 100 },
  ],
): AwardGame => ({
  gameId: id,
  fixtureId: "fixture",
  revision: 1,
  fingerprint: "source",
  at: weeks[week - 1].startsAt,
  scores,
});
const set = (week: number, count: number, scores?: AwardGame["scores"]) =>
  Array.from({ length: count }, (_, i) => game(week * 100 + i, week, scores));
describe("approved weekly award policy", () => {
  it("uses strict independent thresholds and explicit low Tiers", () => {
    const [five] = weeklyStandings(weeks, [{ userId: 2, tier: 4 }], set(1, 5));
    expect(five.mvp).toEqual([]);
    expect(five.rookie).toEqual([2]);
    expect(five.mip).toEqual([]);
    const [six] = weeklyStandings(
      weeks,
      [
        { userId: 2, tier: 5 },
        { userId: 1, tier: 3 },
      ],
      set(1, 6),
    );
    expect(six.mvp).toEqual([2]);
    expect(six.rookie).toEqual([2]);
    expect(weeklyStandings(weeks, [], set(1, 6))[0].rookie).toEqual([]);
  });
  it("compares the immediately preceding week with five appearances each and positive absolute gain", () => {
    const results = weeklyStandings(
      weeks,
      [],
      [
        ...set(1, 5),
        ...set(2, 5, [
          { userId: 1, total: 80 },
          { userId: 2, total: 100 },
        ]),
      ],
    );
    expect(results[0].mip).toEqual([]);
    expect(results[1].mip).toEqual([1]);
    expect(results[1].candidates.find((p) => p.userId === 1)?.improvement).toBe(
      300000000,
    );
    expect(
      weeklyStandings(weeks, [], [...set(1, 4), ...set(2, 5)])[1].mip,
    ).toEqual([]);
    expect(
      weeklyStandings(weeks, [], [...set(1, 5), ...set(2, 4)])[1].mip,
    ).toEqual([]);
    expect(
      weeklyStandings(weeks, [], [...set(1, 5), ...set(3, 5)])[2].mip,
    ).toEqual([]);
    expect(
      weeklyStandings(weeks, [], [...set(1, 5), ...set(2, 5)])[1].mip,
    ).toEqual([]);
  });
  it("keeps ties, deduplicates identical games, uses means and handles zero baselines without division", () => {
    const scores = [
      { userId: 1, total: 100 },
      { userId: 2, total: 100 },
    ];
    const values = set(1, 6, scores);
    const report = weeklyStandings(weeks, [], [...values, values[0]])[0];
    expect(report.mvp).toEqual([1, 2]);
    expect(report.candidates[0].appearances).toBe(6);
    expect(report.candidates[0].performance).toBe(1000000000);
    expect(awardPercentage(report.candidates[0].performance)).toBe(
      "100.0000000%",
    );
    expect(
      weeklyStandings(
        weeks,
        [],
        [
          ...set(1, 5, [
            { userId: 1, total: 0 },
            { userId: 2, total: 100 },
          ]),
          ...set(2, 5),
        ],
      )[1].mip,
    ).toEqual([1]);
  });
  it("flags conflicting, missing-time and invalid games; boundaries are half open", () => {
    const duplicate = game(1, 1);
    const conflict = { ...duplicate, scores: [{ userId: 1, total: 1 }] };
    expect(
      weeklyStandings(weeks, [], [duplicate, conflict])[0].issues,
    ).toHaveLength(1);
    expect(
      weeklyStandings(weeks, [], [{ ...duplicate, at: null }]).every(
        (w) => w.issues.length,
      ),
    ).toBe(true);
    expect(
      weeklyStandings(weeks, [], [{ ...duplicate, at: "bad" }])[0].issues
        .length,
    ).toBeGreaterThan(0);
    expect(
      weeklyStandings(weeks, [], [{ ...duplicate, at: weeks[0].endsAt }])[1]
        .candidates,
    ).toHaveLength(2);
    expect(
      weeklyStandings(weeks, [], [game(1, 1, [{ userId: 1, total: 0 }])])[0]
        .candidates,
    ).toEqual([]);
  });
  it("validates explicit consecutive nonoverlapping weeks and rejects manual Tier commands", () => {
    expect(awardConfigurationSchema.safeParse({ weeks }).success).toBe(true);
    expect(
      awardConfigurationSchema.safeParse({ weeks: [weeks[1]] }).success,
    ).toBe(false);
    expect(
      awardConfigurationSchema.safeParse({
        weeks: [{ ...weeks[0], endsAt: weeks[0].startsAt }],
      }).success,
    ).toBe(false);
    expect(
      awardConfigurationSchema.safeParse({
        weeks,
        tiers: [
          { userId: 1, tier: 4 },
          { userId: 1, tier: 5 },
        ],
      }).success,
    ).toBe(false);
  });
});
