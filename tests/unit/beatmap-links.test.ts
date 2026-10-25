import { describe, expect, it } from "vitest";
import { beatmapLinks } from "../../src/lib/beatmap-links";

describe("official beatmap destinations", () => {
  it("keeps difficulty and set identities separate", () => {
    expect(beatmapLinks(123, 456)).toEqual({
      web: "https://osu.ppy.sh/beatmaps/123",
      direct: "osu://dl/456",
      download: "https://osu.ppy.sh/beatmapsets/456/download",
    });
    expect(beatmapLinks(null, 456).web).toBe(
      "https://osu.ppy.sh/beatmapsets/456",
    );
  });
  it.each([
    null,
    undefined,
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER + 1,
  ])("does not guess an invalid set ID (%s)", (id) => {
    expect(beatmapLinks(123, id)).toEqual({
      web: "https://osu.ppy.sh/beatmaps/123",
      direct: null,
      download: null,
    });
    expect(beatmapLinks(id, id)).toEqual({
      web: null,
      direct: null,
      download: null,
    });
  });
});
