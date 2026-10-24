import { describe, expect, it } from "vitest";
import {
  tournamentStages,
  type PlannedStage,
} from "../../src/lib/tournament-stages";
const phase = (id: string, at?: string): PlannedStage => ({
  id,
  label: id,
  at,
  href: "#schedule",
  action: "View schedule",
});
const now = Date.parse("2026-11-28T12:00:00Z");
describe("public tournament stage chronology", () => {
  it("keeps past and future dates without declaring scheduled events completed", () => {
    const result = tournamentStages(
      [
        phase("final", "2027-01-10"),
        phase("registration", "2026-11-23"),
        phase("draft", "2026-11-28"),
      ],
      { ...phase("draft"), phaseId: "draft" },
      now,
    );
    expect(result.map(({ id, state }) => [id, state])).toEqual([
      ["registration", "past"],
      ["draft", "current"],
      ["final", "upcoming"],
    ]);
  });
  it("retains undated plans without treating them as completed", () => {
    const result = tournamentStages(
      [phase("unknown"), phase("invalid", "invalid")],
      phase("current"),
      now,
    );
    expect(result.map((s) => s.state)).toEqual([
      "current",
      "planned",
      "planned",
    ]);
  });
  it("matches the registration ID independently of a translated label and keeps its live action", () => {
    const result = tournamentStages(
      [phase("registration", "2026-11-23")],
      {
        label: "报名阶段",
        href: "/register",
        action: "个人报名",
        phaseId: "registration",
      },
      now,
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "registration",
      label: "报名阶段",
      href: "/register",
      state: "current",
    });
  });
  it("inserts a published active stage between earlier and upcoming plans", () => {
    const result = tournamentStages(
      [phase("past", "2026-11-01"), phase("future", "2026-12-01")],
      phase("live"),
      now,
    );
    expect(result.map((s) => s.label)).toEqual(["past", "live", "future"]);
  });
});
