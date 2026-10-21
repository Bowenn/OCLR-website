import { describe, expect, it } from "vitest";
import {
  formatBeatmapDuration,
  formatBeatmapNumber,
} from "../../src/lib/mappool-model";
describe("shared provider beatmap formatting", () => {
  it.each([
    [0, "0:00"],
    [59, "0:59"],
    [123, "2:03"],
    [3601, "60:01"],
    [123.9, "2:03"],
    [null, "—"],
    [undefined, "—"],
    [-1, "—"],
    [Infinity, "—"],
  ] as const)(
    "formats duration %s without inventing a value",
    (input, expected) => {
      expect(formatBeatmapDuration(input)).toBe(expected);
    },
  );
  it.each([
    [0, "0"],
    [9.2, "9.2"],
    [9.237, "9.24"],
    [null, "—"],
    [undefined, "—"],
    [NaN, "—"],
  ] as const)("formats base attribute %s", (input, expected) => {
    expect(formatBeatmapNumber(input)).toBe(expected);
  });
  it("keeps two decimal places for base and official mod SR", () => {
    expect(formatBeatmapNumber(4, 2)).toBe("4.00");
    expect(formatBeatmapNumber(6.756, 2)).toBe("6.76");
    expect(formatBeatmapNumber(null, 2)).toBe("—");
  });
});
