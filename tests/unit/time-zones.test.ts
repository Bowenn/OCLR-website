import { describe, expect, it, vi } from "vitest";
import {
  availableTimeZones,
  searchTimeZones,
  timeZoneLabel,
} from "../../src/lib/time-zones";
describe("searchable IANA choices", () => {
  it("includes common and less-common zones and preserves valid saved aliases", () => {
    const zones = availableTimeZones("US/Eastern");
    expect(zones).toContain("UTC");
    expect(zones).toContain("America/New_York");
    expect(zones).toContain("Pacific/Chatham");
    expect(zones).toContain("US/Eastern");
    expect(new Set(zones).size).toBe(zones.length);
    expect(availableTimeZones("bad/zone")).not.toContain("bad/zone");
  });
  it("searches city, region, spaced names and full identifiers", () => {
    const zones = availableTimeZones("UTC");
    for (const term of ["hong", "hong kong", "Hong_Kong", "Asia/Hong_Kong"])
      expect(searchTimeZones(zones, term)).toContain("Asia/Hong_Kong");
    expect(searchTimeZones(zones, "new york")).toContain("America/New_York");
    expect(searchTimeZones(zones, "europe").length).toBeGreaterThan(10);
    expect(timeZoneLabel("Asia/Hong_Kong")).toBe("Hong Kong — Asia/Hong_Kong");
    expect(timeZoneLabel("UTC")).toBe("UTC");
  });
  it("uses the full bundled snapshot if enumeration is unavailable", () => {
    const spy = vi.spyOn(Intl, "supportedValuesOf").mockImplementation(() => {
      throw new Error("unavailable");
    });
    try {
      const zones = availableTimeZones("US/Eastern");
      expect(zones.length).toBeGreaterThan(400);
      expect(zones).toContain("Asia/Taipei");
      expect(zones).toContain("US/Eastern");
    } finally {
      spy.mockRestore();
    }
  });
});
