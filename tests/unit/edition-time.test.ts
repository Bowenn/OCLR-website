import { expect, it } from "vitest";
import { localDateTime, zonedInstants } from "../../src/lib/edition-time";
it("converts wall-clock input in the edition zone rather than the browser zone", () => {
  expect(zonedInstants("2026-06-01T12:30", "Asia/Taipei")).toEqual([
    "2026-06-01T04:30:00.000Z",
  ]);
  expect(localDateTime("2026-06-01T04:30:00.000Z", "Asia/Taipei")).toBe(
    "2026-06-01T12:30",
  );
  expect(zonedInstants("2026-06-01T12:00", "Asia/Kathmandu")).toEqual([
    "2026-06-01T06:15:00.000Z",
  ]);
});
it("requires an explicit offset choice for ambiguous clock changes and rejects nonexistent/invalid dates", () => {
  expect(zonedInstants("2026-11-01T01:30", "America/New_York")).toEqual([
    "2026-11-01T05:30:00.000Z",
    "2026-11-01T06:30:00.000Z",
  ]);
  expect(zonedInstants("2026-03-08T02:30", "America/New_York")).toEqual([]);
  expect(zonedInstants("2026-02-30T12:00", "UTC")).toEqual([]);
  expect(zonedInstants("not-a-date", "UTC")).toEqual([]);
});
