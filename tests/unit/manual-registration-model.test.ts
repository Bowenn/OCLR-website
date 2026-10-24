import { describe, expect, it } from "vitest";
import { parseManualLines } from "../../src/lib/manual-registration-model";
describe("manual registration line syntax", () => {
  it("preserves names, empty-line positions and explicit mixed-type intent", () => {
    const rows = parseManualLines(
      "\r\n  [Player Name]  \r\nname: 12345\nid: 12345\nhttps://osu.ppy.sh/users/1\n",
      "username",
    );
    expect(rows.map((r) => [r.line, r.input, r.inputType])).toEqual([
      [2, "[Player Name]", "username"],
      [3, "12345", "username"],
      [4, "12345", "id"],
      [5, "https://osu.ppy.sh/users/1", "id"],
    ]);
    expect(rows[0].raw).toBe("  [Player Name]  ");
    expect(parseManualLines("12345", "id")[0].inputType).toBe("id");
  });
  it("bounds content and non-empty row count before provider work", () => {
    for (const text of ["  \n", "1\n".repeat(21), "a".repeat(8193)])
      expect(() => parseManualLines(text, "username")).toThrow();
    expect(parseManualLines("1\n".repeat(20), "id")).toHaveLength(20);
  });
});
