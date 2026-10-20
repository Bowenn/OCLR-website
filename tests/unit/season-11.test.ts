import { afterEach, expect, it, vi } from "vitest";
import {
  getEditions,
  getPublicEdition,
  getPublicEditions,
} from "../../src/lib/content";
import { enrollmentState } from "../../src/lib/editions";
afterEach(() => vi.unstubAllEnvs());
it("keeps the prepared S11 edition private and registration unavailable until approved content exists", () => {
  vi.stubEnv("OCLR_EDITIONS_FILE", "");
  const season = getEditions().find((e) => e.slug === "s11");
  expect(season).toMatchObject({
    name: "OCLR Season 11",
    published: false,
    rules: null,
    eligibility: null,
    registration: null,
    schedule: [],
  });
  expect(enrollmentState(season!)).toBe("unannounced");
  expect(getPublicEdition("s11")).toBeUndefined();
  expect(getPublicEditions().some((e) => e.slug === "s11")).toBe(false);
});
