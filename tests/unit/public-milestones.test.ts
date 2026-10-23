import { describe, expect, it } from "vitest";
import {
  nextConfirmedMilestone,
  milestoneLabel,
  registrationCountdown,
  nextPlannedMilestone,
} from "../../src/lib/public-milestones";
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

describe("registration countdown presentation", () => {
  const window = {
    opensAt: "2026-11-01T00:00:00Z",
    closesAt: "2026-11-03T00:00:00Z",
  };
  const at = (date: string) => Date.parse(date);
  it("counts down to opening, then closing, with actual window progress", () => {
    expect(
      registrationCountdown(window, "upcoming", at("2026-10-30T22:57:56Z")),
    ).toMatchObject({
      phase: "upcoming",
      target: window.opensAt,
      days: 1,
      hours: 1,
      minutes: 2,
      seconds: 4,
      elapsed: 0,
    });
    expect(
      registrationCountdown(window, "upcoming", at(window.opensAt)),
    ).toMatchObject({
      phase: "open",
      target: window.closesAt,
      days: 2,
      elapsed: 0,
    });
    expect(
      registrationCountdown(window, "open", at("2026-11-02T00:00:00Z")),
    ).toMatchObject({ phase: "open", days: 1, elapsed: 50 });
    expect(
      registrationCountdown(window, "open", at(window.closesAt)),
    ).toMatchObject({
      phase: "closed",
      target: null,
      days: 0,
      seconds: 0,
      elapsed: 100,
    });
    expect(
      registrationCountdown(window, "open", at("2026-11-04T00:00:00Z"))
        ?.elapsed,
    ).toBe(100);
  });
  it("does not invent countdowns for disabled, unavailable or unconfigured registration", () => {
    for (const state of [
      "unannounced",
      "paused",
      "unavailable",
      "closed",
    ] as const)
      expect(
        registrationCountdown(window, state, at(window.opensAt)),
      ).toBeNull();
    expect(
      registrationCountdown(null, "upcoming", at(window.opensAt)),
    ).toBeNull();
    for (const closesAt of ["invalid", window.opensAt, "2026-10-01T00:00:00Z"])
      expect(
        registrationCountdown(
          { ...window, closesAt },
          "open",
          at(window.opensAt),
        ),
      ).toBeNull();
  });
  it("uses instants across time zones and never rounds an active countdown below zero", () => {
    const result = registrationCountdown(
      {
        opensAt: "2026-11-01T08:00:00+08:00",
        closesAt: "2026-11-03T08:00:00+08:00",
      },
      "open",
      at(window.closesAt) - 1,
    );
    expect(result).toMatchObject({
      phase: "open",
      seconds: 1,
      days: 0,
      hours: 0,
      minutes: 0,
    });
  });
  it("identifies only the next future planned milestone while preserving authored order", () => {
    const schedule = [
      { label: "Past plan", at: "2026-10-01T00:00:00Z" },
      { label: "TBA", at: null },
      { label: "Later", at: "2026-12-01T00:00:00Z" },
      { label: "Next", at: window.closesAt },
    ];
    expect(nextPlannedMilestone(schedule, at(window.opensAt))).toBe(3);
    expect(nextPlannedMilestone(schedule, at("2027-01-01T00:00:00Z"))).toBe(-1);
    expect(schedule[0].label).toBe("Past plan");
    expect(nextPlannedMilestone([], at(window.opensAt))).toBe(-1);
  });
});

it("localizes system semantics without translating authored matching labels", () => {
 const translate = (s: string) => ({ "Registration window begins": "報名開放", "Registration window ends": "報名截止", "Withdrawal deadline": "退出截止時間" })[s] ?? s;
 expect(milestoneLabel({ kind: "registration_closes", label: "Registration window ends" }, translate)).toBe("報名截止");
 expect(milestoneLabel({ label: "Registration window ends" }, translate)).toBe("Registration window ends");
 expect(milestoneLabel({kind: "registration_opens", label: "ignored"}, translate)).toBe("報名開放");
 expect(milestoneLabel({kind: "withdrawal_deadline", label: "ignored"}, translate)).toBe("退出截止時間");
});
