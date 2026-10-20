import { createHash } from "node:crypto";
import { enrollmentState, formatDate, type Edition } from "./editions";
import type { announcementsSchema } from "./announcements";
import type { z } from "zod";
export type PublicNewsItem = {
  slug: string;
  title: string;
  summary: string;
  at: string;
  timeZone: string;
  kind:
    | "announcement"
    | "schedule"
    | "registration"
    | "mappool"
    | "fixture"
    | "result";
  future: boolean;
  source: { label: string; url: string } | null;
  sections: { heading: string; body: string }[];
};
export type NewsEdition = { edition: Edition; locked: boolean };
export type OfficialNewsEvent = {
  editionSlug: string;
  kind: "mappool" | "fixture" | "result";
  id: string;
  title: string;
  summary: string;
  at: string;
  url: string;
};
function eventSlug(edition: string, kind: string, id: string) {
  return `event-${createHash("sha256")
    .update(JSON.stringify([edition, kind, id]))
    .digest("hex")
    .slice(0, 32)}`;
}
/** Read-only projection: clock changes never certify that a scheduled competition event occurred. */
export function projectPublicNews(
  editions: NewsEdition[],
  events: OfficialNewsEvent[],
  manual: z.infer<typeof announcementsSchema>,
  privacyConfigured: boolean,
  now = new Date(),
): PublicNewsItem[] {
  const items: PublicNewsItem[] = manual
    .filter(
      (a) =>
        a.published &&
        a.publishedAt &&
        Date.parse(a.publishedAt) <= now.getTime(),
    )
    .map((a) => ({
      ...a,
      at: a.publishedAt!,
      timeZone: "UTC",
      kind: "announcement",
      future: false,
      source: null,
    }));
  for (const { edition: e, locked } of editions.filter(
    (r) => r.edition.published,
  )) {
    function add(
      kind: PublicNewsItem["kind"],
      id: string,
      title: string,
      summary: string,
      at: string,
      path: string,
    ) {
      items.push({
        slug: eventSlug(e.slug, kind, id),
        title: `${title} — ${e.name}`,
        summary,
        at,
        timeZone: e.timeZone,
        kind,
        future: Date.parse(at) > now.getTime(),
        source: { label: e.name, url: path },
        sections: [],
      });
    }
    if (e.registration) {
      const r = e.registration;
      const available =
        !locked && privacyConfigured && enrollmentState(e, now) === "open";
      add(
        "registration",
        "opens",
        available ? "Registration is open" : "Registration window",
        `Configured registration window: ${formatDate(r.opensAt, e.timeZone)} to ${formatDate(r.closesAt, e.timeZone)}. ${available ? "Applications are currently accepted." : "Applications require enabled registration and an available tournament; check the registration page for current availability."}`,
        r.opensAt,
        `/tournaments/${e.slug}/register`,
      );
      add(
        "registration",
        "closes",
        Date.parse(r.closesAt) <= now.getTime()
          ? "Registration window ended"
          : "Registration closing deadline",
        `The configured registration window ends at ${formatDate(r.closesAt, e.timeZone)}.`,
        r.closesAt,
        `/tournaments/${e.slug}/register`,
      );
      if (r.withdrawUntil)
        add(
          "registration",
          "withdrawal",
          "Withdrawal deadline",
          `The configured withdrawal cutoff is ${formatDate(r.withdrawUntil, e.timeZone)}. Available actions depend on the application's status and tournament lock.`,
          r.withdrawUntil,
          `/tournaments/${e.slug}/register`,
        );
    }
    for (const entry of e.schedule)
      if (entry.at) {
        add(
          "schedule",
          JSON.stringify([entry.label, entry.at]),
          `Scheduled: ${entry.label}`,
          `${entry.label} is scheduled for ${formatDate(entry.at, e.timeZone)}. This published date is a plan, not confirmation that the event took place.`,
          entry.at,
          `/tournaments/${e.slug}/schedule`,
        );
      }
    for (const event of events.filter(
      (v) => v.editionSlug === e.slug && Date.parse(v.at) <= now.getTime(),
    ))
      add(
        event.kind,
        event.id,
        event.title,
        event.summary,
        event.at,
        event.url,
      );
  }
  return [...new Map(items.map((item) => [item.slug, item])).values()].sort(
    (a, b) =>
      Number(a.future) - Number(b.future) ||
      (a.future
        ? Date.parse(a.at) - Date.parse(b.at)
        : Date.parse(b.at) - Date.parse(a.at)) ||
      a.slug.localeCompare(b.slug),
  );
}
