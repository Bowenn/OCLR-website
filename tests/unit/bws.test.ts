import { describe, expect, it } from "vitest";
import { calculateBws, summarizeBws } from "../../src/lib/bws-model";
import { normalizeOsuProfile } from "../../src/lib/osu-profile-model";
const badge = {
  description: "Synthetic tournament",
  awarded_at: "2026-01-01T00:00:00Z",
  url: "https://osu.ppy.sh/wiki/en/Tournaments",
};
const profile = (badges: unknown, rank: unknown = 10000) =>
  normalizeOsuProfile(
    { id: 1, username: "Synthetic", badges, statistics: { global_rank: rank } },
    1,
    "osu",
  );
describe("badge-weighted seeding", () => {
  it("uses the official formula without rounding the numeric result", () => {
    expect(calculateBws(10000, 0)).toBe(10000);
    expect(calculateBws(10000, 1)).toBe(10000 ** 0.9937);
    for (let i = 0; i < 100; i++) {
      expect(calculateBws(10000, i)!).toBeLessThanOrEqual(10000);
      expect(calculateBws(10000, i + 1)!).toBeLessThanOrEqual(
        calculateBws(10000, i)!,
      );
      expect(calculateBws(1, i)).toBe(1);
    }
    expect(calculateBws(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER)).toBe(
      1,
    );
  });
  it("rejects unranked, fractional, unsafe and nonfinite inputs", () => {
    for (const rank of [
      null,
      undefined,
      0,
      -1,
      1.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      "10000",
    ])
      expect(calculateBws(rank, 0)).toBeNull();
    for (const count of [
      null,
      undefined,
      -1,
      0.5,
      NaN,
      Infinity,
      Number.MAX_SAFE_INTEGER + 1,
      "0",
    ])
      expect(calculateBws(10000, count)).toBeNull();
  });
  it("never equates missing/partial API badge data with zero eligible badges", () => {
    for (const badges of [
      undefined,
      null,
      {},
      [{}],
      [{ ...badge, awarded_at: "invalid" }],
      Array(101).fill(badge),
    ]) {
      const p = profile(badges);
      expect(p.badges).toBeNull();
      expect(
        summarizeBws({ profile: p, stale: false, notice: null }, null),
      ).toMatchObject({ status: "pending", value: null, badgeCount: null });
    }
    expect(
      summarizeBws({ profile: profile([]), stale: false, notice: null }, null),
    ).toMatchObject({ status: "ready", value: 10000, badgeCount: 0 });
  });
  it("requires complete explicit mode-aware review and excludes other awards", () => {
    const snapshot = {
      profile: profile([badge, badge, badge]),
      stale: false,
      notice: null,
    };
    expect(summarizeBws(snapshot, null).value).toBeNull();
    expect(
      summarizeBws(snapshot, ["osu", "unknown", "other"]).value,
    ).toBeNull();
    expect(summarizeBws(snapshot, ["osu", "taiko", "other"])).toMatchObject({
      badgeCount: 1,
      value: 10000 ** 0.9937,
    });
    expect(
      summarizeBws({ ...snapshot, stale: true }, ["osu", "taiko", "other"])
        .status,
    ).toBe("stale");
    expect(
      profile([{ ...badge, url: "javascript:alert(1)" }]).badges![0].url,
    ).toBeNull();
    expect(
      summarizeBws(
        { profile: profile([], null), stale: false, notice: null },
        null,
      ).status,
    ).toBe("unranked");
  });
});
