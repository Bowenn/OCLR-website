import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
vi.mock("../../src/lib/osu-api", () => ({ osuApi: vi.fn() }));
const base = {
  id: 123,
  beatmapset_id: 42,
  version: "Synthetic Difficulty",
  difficulty_rating: 4.5,
  bpm: 180,
  total_length: 123,
  mode: "osu",
  ar: 9.2,
  accuracy: 8.5,
  cs: 4,
  drain: null,
  beatmapset: {
    artist: "Synthetic Artist",
    title: "Synthetic Song",
    creator: "Synthetic Mapper",
  },
};
describe("explicit official difficulty attributes", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  async function setup() {
    const { osuApi } = await import("../../src/lib/osu-api");
    vi.mocked(osuApi)
      .mockReset()
      .mockImplementation(async (path) =>
        path.endsWith("/attributes")
          ? {
              attributes: {
                star_rating: 6.75,
                max_combo: 1234,
                approach_rate: 10.3,
                aim_difficulty: 3.21,
              },
            }
          : base,
      );
    const beatmaps = await import("../../src/lib/osu-beatmaps");
    return { ...beatmaps, api: vi.mocked(osuApi) };
  }
  it("normalizes nullable base fields and separates configured official values without changing base timing", async () => {
    const { fetchBeatmap, withBeatmapAttributes, api } = await setup();
    const map = await fetchBeatmap(123);
    expect(map.metadata).toMatchObject({
      stars: 4.5,
      ar: 9.2,
      od: 8.5,
      cs: 4,
      hp: null,
    });
    const [dt, same] = await Promise.all([
      withBeatmapAttributes(map, "DT"),
      withBeatmapAttributes(map, "DT"),
    ]);
    expect(dt).toEqual(same);
    expect(dt.metadata).toMatchObject({
      bpm: 180,
      duration: 123,
      stars: 4.5,
      attributes: {
        configuration: "DT",
        mods: ["DT"],
        stars: 6.75,
        maxCombo: 1234,
        ruleset: "osu",
        values: { approach_rate: 10.3 },
      },
    });
    expect(api).toHaveBeenCalledWith("/beatmaps/123/attributes", {
      mods: ["DT"],
      ruleset: "osu",
    });
    expect(api).toHaveBeenCalledTimes(2);
    expect((await withBeatmapAttributes(map, "DT")).fingerprint).toBe(
      dt.fingerprint,
    );
    expect((await withBeatmapAttributes(map, "HR")).fingerprint).not.toBe(
      dt.fingerprint,
    );
  });
  it("does not invent FM/TB mods or accept incomplete attributes and missing rulesets", async () => {
    const { fetchBeatmap, withBeatmapAttributes, api } = await setup();
    const map = await fetchBeatmap(123);
    expect(await withBeatmapAttributes(map, null)).toEqual(map);
    expect(api).toHaveBeenCalledTimes(1);
    await expect(
      withBeatmapAttributes(
        { ...map, metadata: { ...map.metadata, mode: undefined } },
        "DT",
      ),
    ).rejects.toMatchObject({ status: 502 });
    api.mockResolvedValueOnce({ attributes: { max_combo: 123 } });
    await expect(withBeatmapAttributes(map, "HR")).rejects.toMatchObject({
      status: 502,
    });
    expect(map.metadata.attributes).toBeUndefined();
  });
  it("expires calculated snapshots and coalesces refreshes without mutating the last saved value", async () => {
    vi.useFakeTimers();
    const { fetchBeatmap, withBeatmapAttributes, api } = await setup();
    const base = await fetchBeatmap(123),
      first = await withBeatmapAttributes(base, "HR");
    await vi.advanceTimersByTimeAsync(15 * 60000 + 1);
    api.mockResolvedValueOnce({ attributes: { star_rating: 7.5 } });
    const [updated, same] = await Promise.all([
      withBeatmapAttributes(base, "HR"),
      withBeatmapAttributes(base, "HR"),
    ]);
    expect(updated).toEqual(same);
    expect(updated.metadata.attributes?.stars).toBe(7.5);
    expect(first.metadata.attributes?.stars).toBe(6.75);
    expect(api).toHaveBeenCalledTimes(3);
  });
});
