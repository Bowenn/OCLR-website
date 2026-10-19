import { expect, it } from "vitest";
import { csv, csvCell } from "../../src/lib/csv";
it("neutralizes spreadsheet formulas including whitespace/control prefixes", () => {
  for (const value of [
    "=1+1",
    "+CMD",
    "-1+1",
    "@SUM(A1)",
    "  =1+1",
    '\t=HYPERLINK("https://example.test")',
    "\r1",
    "\ntext",
  ])
    expect(csvCell(value)).toMatch(/^"'/);
  expect(csvCell('A "name", next')).toBe('"A ""name"", next"');
  expect(csv([[123, "plain"]])).toBe('\uFEFF"123","plain"\r\n');
});
