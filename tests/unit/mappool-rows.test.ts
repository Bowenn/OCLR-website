import { describe, expect, it } from "vitest";
import {
  moveMappoolEntries,
  parseMappoolRows,
} from "../../src/lib/mappool-model";

describe("mappool auto-slot parsing", () => {
  it("resolves plain IDs and canonical difficulty URLs in pasted order", () => {
    const rows = parseMappoolRows(
      "123\nhttps://osu.ppy.sh/beatmaps/456\nhttps://osu.ppy.sh/beatmapsets/42#osu/789",
      "NM",
    );
    expect(
      rows.map((r) => [r.category, r.position, r.beatmapId, r.error]),
    ).toEqual([
      ["NM", 1, 123, null],
      ["NM", 2, 456, null],
      ["NM", 3, 789, null],
    ]);
  });
  it("appends after the highest saved slot and leaves saved gaps untouched", () => {
    expect(
      parseMappoolRows("123\n456", "HD", [
        { category: "HD", position: 5, beatmapId: 42 },
      ]).map((r) => r.position),
    ).toEqual([6, 7]);
  });
  it("reserves explicit slots regardless of input order and retains mixed categories", () => {
    const rows = parseMappoolRows("123\nNM1 456\nHD2 789\n42\nTB 123", "NM");
    expect(rows.map((r) => [r.category, r.position, r.error])).toEqual([
      ["NM", 2, null],
      ["NM", 1, null],
      ["HD", 2, null],
      ["NM", 3, null],
      ["TB", 1, null],
    ]);
  });
  it("retains original line numbers and distinguishes map errors from slot errors", () => {
    const rows = parseMappoolRows(
      "\nhttps://osu.ppy.sh/beatmapsets/42\nNM0 123\nNM1 123 extra\n456",
      "NM",
    );
    expect(rows.map((r) => r.line)).toEqual([2, 3, 4, 5]);
    expect(rows[0].error).toContain("Invalid beatmap");
    expect(rows[1].error).toContain("Invalid slot");
    expect(rows[2].error).toContain("Invalid slot");
    expect(rows[3].error).toBeNull();
  });
  it("detects canonical duplicate IDs, slot collisions and already saved maps", () => {
    const rows = parseMappoolRows(
      "123\nhttps://osu.ppy.sh/beatmaps/123\nHD1 456\nHD1 789\nHD2 42",
      "NM",
      [{ category: "HD", position: 1, beatmapId: 42 }],
    );
    expect(rows[1].error).toContain("Duplicate beatmap");
    expect(rows[2].error).toContain("Slot already exists");
    expect(rows[3].error).toContain("Duplicate slot");
    expect(rows[4].error).toContain("Beatmap already exists");
  });
  it("warns rather than forbids intentional reuse across categories", () => {
    const rows = parseMappoolRows("NM1 123\nHD1 123");
    expect(rows.every((r) => !r.error)).toBe(true);
    expect(rows[1].warning).toContain("reused");
  });
  it("requires a category only for unprefixed rows and preserves TB labels", () => {
    expect(parseMappoolRows("123")[0].error).toContain(
      "Choose a destination category",
    );
    expect(parseMappoolRows("TB 123")[0]).toMatchObject({
      category: "TB",
      position: 1,
      error: null,
    });
    expect(parseMappoolRows("123\n456", "TB").map((r) => r.position)).toEqual([
      1, 2,
    ]);
  });
  it("respects slot 999 and rejects overflowing append positions", () => {
    const rows = parseMappoolRows("123\n456", "NM", [
      { category: "NM", position: 998, beatmapId: 42 },
    ]);
    expect(rows[0]).toMatchObject({ position: 999, error: null });
    expect(rows[1].error).toContain("1–999");
  });
  it.each(["", Array(51).fill("123").join("\n"), "1".repeat(16001)])(
    "bounds input without fetching providers",
    (text) => {
      expect(() => parseMappoolRows(text, "NM")).toThrow("1 and 50");
    },
  );
});

describe("mappool occupied insertion preview", () => {
  const entries = [1, 2, 3, 4, 5].map((i) => ({
    id: String(i),
    category: "NM" as const,
    position: i * 2,
    beatmapId: i,
  }));
  it("moves the last map above the second and normalizes gaps without altering identity", () => {
    const moved = moveMappoolEntries(entries, ["5"], "NM", 2);
    expect(moved.map((e) => e.id)).toEqual(["1", "5", "2", "3", "4"]);
    expect(moved.map((e) => e.position)).toEqual([1, 2, 3, 4, 5]);
    expect(entries.map((e) => e.position)).toEqual([2, 4, 6, 8, 10]);
  });
  it("supports first-to-last, multiple entries and explicit cross-category insertion", () => {
    expect(
      moveMappoolEntries(entries, ["1"], "NM", 5).map((e) => e.id),
    ).toEqual(["2", "3", "4", "5", "1"]);
    expect(
      moveMappoolEntries(entries, ["4", "2"], "NM", 1).map((e) => e.id),
    ).toEqual(["4", "2", "1", "3", "5"]);
    expect(
      moveMappoolEntries(entries, ["1", "5"], "HD", 1).map((e) => [
        e.id,
        e.category,
        e.position,
      ]),
    ).toEqual([
      ["1", "HD", 1],
      ["5", "HD", 2],
    ]);
  });
  it("rejects invalid IDs, duplicate category maps and insertion positions", () => {
    expect(() => moveMappoolEntries(entries, ["missing"], "NM", 1)).toThrow(
      "exactly once",
    );
    expect(() => moveMappoolEntries(entries, ["1", "1"], "NM", 1)).toThrow(
      "exactly once",
    );
    expect(() => moveMappoolEntries(entries, ["1"], "NM", 6)).toThrow("1 to 5");
    expect(() =>
      moveMappoolEntries(
        [...entries, { id: "hd", category: "HD", position: 1, beatmapId: 1 }],
        ["1"],
        "HD",
        1,
      ),
    ).toThrow("already exists");
  });
});
