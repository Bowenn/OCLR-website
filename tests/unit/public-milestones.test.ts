import { describe, expect, it } from "vitest";
import { nextConfirmedMilestone } from "../../src/lib/public-milestones";
import { edition } from "../fixtures/edition";
describe("next confirmed public milestone", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  it("uses only future confirmed dates from published, active editions", () => {
    const e = {
      ...edition,
      registration: null,
      schedule: [
        { label: "Final", at: "2026-11-01T12:00:00Z" },
        { label: "Unknown", at: null },
      ],
    };
    expect(
      nextConfirmedMilestone(
        [
          { ...e, published: false },
          { ...e, status: "completed" },
        ],
        now,
      ),
    ).toBeUndefined();
    expect(nextConfirmedMilestone([e], now)).toMatchObject({
      label: "Final",
      at: "2026-11-01T12:00:00Z",
      timeZone: edition.timeZone,
      url: "/tournaments/test-cup/schedule",
    });
    expect(
      nextConfirmedMilestone([e], new Date("2026-12-01T00:00:00Z")),
    ).toBeUndefined();
  });
  it("selects the nearest date and keeps planned wording", () => {
    const result = nextConfirmedMilestone(
      [
        {
          ...edition,
          registration: {
            ...edition.registration!,
            opensAt: "2026-11-01T00:00:00Z",
          },
          schedule: [{ label: "Draft", at: "2026-12-01T00:00:00Z" }],
        },
      ],
      now,
    );
    expect(result?.label).toBe("Registration window begins");
  });
});
