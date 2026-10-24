import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { archiveStaff } from "../../src/lib/archive-staff";
import { historicalArchiveSchema } from "../../src/lib/historical-archive";
const archive = historicalArchiveSchema.parse(
  JSON.parse(readFileSync("docs/imports/s8-archive.json", "utf8")),
);
describe("S8 staff from recorded match evidence", () => {
  it("preserves literal names, separates explicit commentators and deduplicates roles", () => {
    const staff = archiveStaff(archive);
    expect(staff.filter((p) => p.position === "Referee")).toHaveLength(6);
    expect(staff.filter((p) => p.position === "Streamer")).toHaveLength(12);
    expect(
      staff.some(
        (p) => p.username === "Alice Mana" && p.position === "Commentators",
      ),
    ).toBe(true);
    expect(staff.filter((p) => p.username === "U4Dead")).toHaveLength(3);
    expect(
      staff.every((p) => p.osuId === null && p.source.startsWith("Schedule!")),
    ).toBe(true);
    expect(new Set(staff.map((p) => `${p.username}:${p.position}`)).size).toBe(
      staff.length,
    );
    expect(archive.staff).toEqual([]);
    expect(staff.some((p) => p.username === "Sonoboi")).toBe(true);
    expect(staff.some((p) => p.username === "Sonoaoi")).toBe(true);
  });
  it("preserves confirmed staff and does not affect unrelated source workbooks", () => {
    const existing = {
      username: "U4Dead",
      osuId: 123,
      position: "Referee",
      source: "Confirmed staff source",
    };
    const staff = archiveStaff({ ...archive, staff: [existing] });
    expect(
      staff.filter((p) => p.username === "U4Dead" && p.position === "Referee"),
    ).toEqual([existing]);
    expect(
      archiveStaff({
        ...archive,
        sourceUrl: "https://example.com/s8",
        staff: [existing],
      }),
    ).toEqual([existing]);
    expect(
      archiveStaff({
        ...archive,
        matches: archive.matches.map((m) => ({ ...m, score: null })),
      }),
    ).toEqual([]);
  });
});
