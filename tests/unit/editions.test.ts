import { describe, expect, it } from "vitest";
import {
  editionSchema,
  editionsSchema,
  enrollmentState,
  formatDate,
} from "../../src/lib/editions";
import { edition } from "../fixtures/edition";
describe("edition configuration", () => {
  it("validates real content while preventing duplicate editions, invalid dates and timezones", () => {
    expect(editionSchema.safeParse(edition).success).toBe(true);
    expect(editionsSchema.safeParse([edition, edition]).success).toBe(false);
    expect(
      editionSchema.safeParse({ ...edition, timeZone: "invalid" }).success,
    ).toBe(false);
    expect(
      editionSchema.safeParse({
        ...edition,
        registration: {
          ...edition.registration,
          closesAt: "2020-01-01T00:00:00Z",
        },
      }).success,
    ).toBe(false);
  });
  it("requires published rules, eligibility and window before opening; closes at exact boundary", () => {
    expect(enrollmentState({ ...edition, published: false })).toBe(
      "unannounced",
    );
    expect(enrollmentState({ ...edition, rules: null })).toBe("unannounced");
    expect(enrollmentState({ ...edition, eligibility: null })).toBe(
      "unannounced",
    );
    expect(enrollmentState(edition, new Date("2024-12-31T23:59:59Z"))).toBe(
      "upcoming",
    );
    expect(enrollmentState(edition, new Date("2025-01-01T00:00:00Z"))).toBe(
      "open",
    );
    expect(enrollmentState(edition, new Date("2099-01-01T00:00:00Z"))).toBe(
      "closed",
    );
  });
  it("shows an explicit configured timezone and TBA", () => {
    expect(formatDate(null, "Asia/Taipei")).toBe("To be announced");
    expect(formatDate("2026-01-01T00:00:00Z", "Asia/Taipei")).toContain(
      "08:00 (Asia/Taipei)",
    );
  });
});
