import { expect, it } from "vitest";
import {
  dateTimeDraft,
  localDateTime,
  zonedInstants,
} from "../../src/lib/edition-time";
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

it("preserves exact stored timestamps on no-op edits, including seconds, offsets and duplicated hours", () => {
  for (const [instant, zone, date, time] of [
    ["2026-10-11T15:10:42.123+08:00", "Asia/Hong_Kong", "2026-10-11", "15:10"],
    ["2026-10-11T07:10:42.123Z", "UTC", "2026-10-11", "07:10"],
    ["2026-11-01T01:30:17-05:00", "America/New_York", "2026-11-01", "01:30"],
  ])
    expect(dateTimeDraft(date, time, zone, instant, false).value).toBe(instant);
});
it("converts completed 24-hour input and requires explicit duplicated-hour resolution", () => {
  expect(
    dateTimeDraft("2026-10-11", "15:10", "Asia/Hong_Kong", null, false).value,
  ).toBe("2026-10-11T07:10:00.000Z");
  expect(dateTimeDraft("2026-10-11", "15:10", "UTC", null, false).value).toBe(
    "2026-10-11T15:10:00.000Z",
  );
  const repeated = dateTimeDraft(
    "2026-11-01",
    "01:30",
    "America/New_York",
    null,
    false,
  );
  expect(repeated.value).toBeUndefined();
  expect(repeated.candidates).toHaveLength(2);
  expect(
    dateTimeDraft(
      "2026-11-01",
      "01:30",
      "America/New_York",
      null,
      false,
      repeated.candidates[1],
    ).value,
  ).toBe("2026-11-01T06:30:00.000Z");
  expect(
    dateTimeDraft(
      "2026-11-01",
      "01:30",
      "America/New_York",
      repeated.candidates[0],
      false,
      repeated.candidates[1],
    ).value,
  ).toBe(repeated.candidates[1]);
});
it("rejects missing or invalid drafts without manufacturing an instant", () => {
  for (const [date, time, zone] of [
    ["", "", "UTC"],
    ["2026-10-11", "", "UTC"],
    ["", "15:10", "UTC"],
    ["2026-02-30", "15:10", "UTC"],
    ["2026-10-11", "24:00", "UTC"],
    ["2026-10-11", "9:5", "UTC"],
    ["2026-10-11", "12:30 PM", "UTC"],
    ["2026-10-11", "15:10", "Invalid/Zone"],
    ["2026-03-08", "02:30", "America/New_York"],
  ]) {
    const result = dateTimeDraft(
      date,
      time,
      zone,
      "2026-01-01T00:00:42Z",
      false,
    );
    expect(result.value).toBeUndefined();
    expect(result.error).not.toBe("");
  }
  expect(dateTimeDraft("", "", "UTC", null, true).value).toBeNull();
  expect(
    dateTimeDraft("2026-10-11", "", "UTC", null, true).value,
  ).toBeUndefined();
});
