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
