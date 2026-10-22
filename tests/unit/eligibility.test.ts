import { describe, it, expect } from "vitest";
import {
  eligibilityLimitsSchema,
  evaluateEligibility,
  noEligibilityLimits,
} from "../../src/lib/eligibility-model";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
const now = Date.now();
const limits = { ...noEligibilityLimits, maxPp: 8000, minRank: 10000 };
const snapshot = (pp: number | null, rank: number | null) => ({
  profile: normalizeOsuProfile(
    { id: 1, username: "Synthetic", statistics: { pp, global_rank: rank } },
    1,
    "osu",
    new Date(now).toISOString(),
  ),
  stale: false,
  notice: null,
});
describe("osu standard inclusive eligibility", () => {
  it("applies configured bounds together with inclusive equality and no BWS", () => {
    expect(
      evaluateEligibility(1, 4, limits, snapshot(7999, 10000), now).status,
    ).toBe("pass");
    expect(
      evaluateEligibility(1, 4, limits, snapshot(8000, 10000), now).status,
    ).toBe("pass");
    expect(
      evaluateEligibility(1, 4, limits, snapshot(8001, 10000), now).status,
    ).toBe("fail");
    expect(
      evaluateEligibility(1, 4, limits, snapshot(7999, 9999), now).status,
    ).toBe("fail");
    expect(
      evaluateEligibility(1, 4, noEligibilityLimits, null, now).status,
    ).toBe("pass");
    expect(
      evaluateEligibility(
        1,
        4,
        { ...noEligibilityLimits, minPp: 100, maxRank: 1000 },
        snapshot(100, 1000),
        now,
      ).status,
    ).toBe("pass");
  });
  it("does not fabricate missing, stale or wrong-identity/ruleset statistics", () => {
    for (const value of [
      null,
      snapshot(null, null),
      { ...snapshot(1, 10000), stale: true },
      { ...snapshot(1, 10000), notice: "Provider unavailable" },
    ])
      expect(evaluateEligibility(1, 0, limits, value, now).status).toBe(
        "unavailable",
      );
    expect(
      evaluateEligibility(2, 0, limits, snapshot(1, 10000), now).status,
    ).toBe("unavailable");
    expect(
      evaluateEligibility(1, 0, limits, snapshot(1, 10000), now + 300000)
        .status,
    ).toBe("unavailable");
  });
  it("rejects malformed and contradictory configuration", () => {
    for (const value of [
      { maxPp: -1 },
      { minRank: 0 },
      { maxRank: 1.5 },
      { minPp: 2, maxPp: 1 },
      { minRank: 20, maxRank: 10 },
      { maxPp: Infinity },
      { minPp: NaN },
    ])
      expect(
        eligibilityLimitsSchema.safeParse({ ...noEligibilityLimits, ...value })
          .success,
      ).toBe(false);
  });
});
