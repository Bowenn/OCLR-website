import type { Edition } from "./editions";
/** Plans remain plans: a passed date alone never establishes that an event happened. */
export function nextConfirmedMilestone(editions: Edition[], now = new Date()) {
  return editions
    .filter((e) => e.published && e.status !== "completed")
    .flatMap((e) =>
      [
        ...(e.registration
          ? [
              {
                label: "Registration window begins",
                at: e.registration.opensAt,
                path: "register",
              },
              {
                label: "Registration window ends",
                at: e.registration.closesAt,
                path: "register",
              },
              ...(e.registration.withdrawUntil
                ? [
                    {
                      label: "Withdrawal deadline",
                      at: e.registration.withdrawUntil,
                      path: "register",
                    },
                  ]
                : []),
            ]
          : []),
        ...e.schedule
          .filter((s): s is { label: string; at: string } => Boolean(s.at))
          .map((s) => ({ ...s, path: "schedule" })),
      ].map((s) => ({
        ...s,
        edition: e.name,
        timeZone: e.timeZone,
        url: `/tournaments/${e.slug}/${s.path}`,
      })),
    )
    .filter((s) => Date.parse(s.at) > now.getTime())
    .sort(
      (a, b) =>
        Date.parse(a.at) - Date.parse(b.at) ||
        a.url.localeCompare(b.url) ||
        a.label.localeCompare(b.label),
    )[0];
}

export type RegistrationState =
  "unannounced" | "upcoming" | "open" | "closed" | "paused" | "unavailable";
/** Presentation only. Registration acceptance always uses the server's checks. */
export function registrationCountdown(
  registration: Pick<
    NonNullable<Edition["registration"]>,
    "opensAt" | "closesAt"
  > | null,
  state: RegistrationState,
  now: number,
) {
  if (!registration || !["upcoming", "open"].includes(state)) return null;
  const opens = Date.parse(registration.opensAt),
    closes = Date.parse(registration.closesAt);
  if (!Number.isFinite(opens) || !Number.isFinite(closes) || closes <= opens)
    return null;
  const phase = now < opens ? "upcoming" : now < closes ? "open" : "closed";
  const target =
    phase === "upcoming"
      ? registration.opensAt
      : phase === "open"
        ? registration.closesAt
        : null;
  const remaining = target
    ? Math.max(0, Math.ceil((Date.parse(target) - now) / 1000))
    : 0;
  return {
    phase,
    target,
    days: Math.floor(remaining / 86400),
    hours: Math.floor((remaining % 86400) / 3600),
    minutes: Math.floor((remaining % 3600) / 60),
    seconds: remaining % 60,
    elapsed: Math.min(
      100,
      Math.max(0, ((now - opens) / (closes - opens)) * 100),
    ),
  };
}
export function nextPlannedMilestone(
  schedule: Edition["schedule"],
  now: number,
) {
  return schedule.reduce((next, milestone, index) => {
    const at = milestone.at ? Date.parse(milestone.at) : NaN;
    return Number.isFinite(at) &&
      at > now &&
      (next === -1 || at < Date.parse(schedule[next].at!))
      ? index
      : next;
  }, -1);
}
