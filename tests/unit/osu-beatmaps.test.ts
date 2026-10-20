import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseBeatmapId } from "../../src/lib/osu-beatmaps";
const token = () =>
  new Response(
    JSON.stringify({
      access_token: "synthetic-provider-token",
      token_type: "Bearer",
      expires_in: 3600,
    }),
    { status: 200 },
  );
const map = {
  id: 123,
  beatmapset_id: 42,
  version: "Synthetic Difficulty",
  difficulty_rating: 4.5,
  bpm: 180,
  total_length: 123,
  beatmapset: {
    artist: "Synthetic Artist",
    title: "Synthetic Song",
    creator: "Synthetic Mapper",
  },
};
describe("official beatmap parsing and server API boundaries", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("OSU_CLIENT_ID", "123");
    vi.stubEnv("OSU_CLIENT_SECRET", "synthetic-test-secret");
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });
  it("accepts IDs and canonical difficulty URLs, never arbitrary URLs or beatmapset-only links", () => {
    for (const value of [
      "123",
      "https://osu.ppy.sh/beatmaps/123",
      "https://osu.ppy.sh/b/123",
      "https://osu.ppy.sh/beatmapsets/42#osu/123",
    ])
      expect(parseBeatmapId(value)).toBe(123);
    for (const value of [
      "0",
      "-1",
      "1e2",
      "9007199254740993",
      "https://example.com/beatmaps/123",
      "https://osu.ppy.sh@evil.example/beatmaps/123",
      "https://osu.ppy.sh/beatmapsets/42",
      "https://osu.ppy.sh/beatmaps/123?url=https://example.com",
      "file:///beatmaps/123",
    ])
      expect(() => parseBeatmapId(value)).toThrow();
  });
  it("uses a server client-credentials public token, reuses it, and normalizes only necessary metadata", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response(JSON.stringify(map)))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...map, id: 456 })));
    vi.stubGlobal("fetch", fetch);
    const { fetchBeatmap } = await import("../../src/lib/osu-beatmaps");
    const [first, simultaneous] = await Promise.all([
      fetchBeatmap(123),
      fetchBeatmap(123),
    ]);
    expect(first).toEqual(simultaneous);
    expect(first).toEqual({
      setId: 42,
      title: "Synthetic Song",
      artist: "Synthetic Artist",
      mapper: "Synthetic Mapper",
      difficulty: "Synthetic Difficulty",
      stars: 4.5,
      bpm: 180,
      duration: 123,
    });
    await fetchBeatmap(123); // Cached metadata avoids duplicate provider reads.
    await fetchBeatmap(456);
    expect(fetch).toHaveBeenCalledTimes(3);
    expect(fetch.mock.calls[0][0]).toBe("https://osu.ppy.sh/oauth/token");
    const body = fetch.mock.calls[0][1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("client_credentials");
    expect(body.get("scope")).toBe("public");
    expect(fetch.mock.calls[1][0]).toBe(
      "https://osu.ppy.sh/api/v2/beatmaps/123",
    );
    expect(fetch.mock.calls[1][1].headers.Authorization).toBe(
      "Bearer synthetic-provider-token",
    );
  });
  it("fails closed without API credentials and rejects arbitrary API paths", async () => {
    vi.stubEnv("OSU_CLIENT_SECRET", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const { fetchBeatmap } = await import("../../src/lib/osu-beatmaps");
    await expect(fetchBeatmap(123)).rejects.toMatchObject({ status: 503 });
    const { osuApi } = await import("../../src/lib/osu-api");
    await expect(osuApi("https://example.com")).rejects.toMatchObject({
      status: 400,
    });
    expect(fetch).not.toHaveBeenCalled();
  });
  it("reports rate limits without disclosing tokens or returning invented metadata", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(
        new Response("private provider body", {
          status: 429,
          headers: { "Retry-After": "60" },
        }),
      );
    vi.stubGlobal("fetch", fetch);
    const { fetchBeatmap } = await import("../../src/lib/osu-beatmaps");
    await expect(fetchBeatmap(123)).rejects.toMatchObject({ status: 429 });
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it("rejects deleted, malformed or mismatched provider records", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ...map, id: 456 })))
      .mockResolvedValueOnce(new Response("not json"));
    vi.stubGlobal("fetch", fetch);
    const { fetchBeatmap } = await import("../../src/lib/osu-beatmaps");
    await expect(fetchBeatmap(123)).rejects.toMatchObject({ status: 404 });
    await expect(fetchBeatmap(123)).rejects.toMatchObject({ status: 502 });
    await expect(fetchBeatmap(123)).rejects.toMatchObject({ status: 502 });
  });
  it("retries transient provider failures once with a bounded delay", async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(token())
      .mockResolvedValueOnce(new Response("", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(map)));
    vi.stubGlobal("fetch", fetch);
    const { fetchBeatmap } = await import("../../src/lib/osu-beatmaps");
    expect((await fetchBeatmap(123)).setId).toBe(42);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
