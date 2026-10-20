import { expect, it } from "vitest";
import initialEditions from "../../drizzle/legacy-editions.json" with { type: "json" };
import { enrollmentState, editionSchema } from "../../src/lib/editions";
it("keeps the prepared S11 edition private and registration unavailable until approved content exists", () => {
  const season = editionSchema.parse(
    initialEditions.find((e) => e.slug === "s11"),
  );
  expect(season).toMatchObject({
    name: "OCLR Season 11",
    published: false,
    rules: null,
    eligibility: null,
    registration: null,
    schedule: [],
  });
  expect(enrollmentState(season!)).toBe("unannounced");
});
