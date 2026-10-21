import { cache } from "react";
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { mappools, tournamentRounds } from "@/db/schema";
import { readTournaments } from "./tournaments";
import { getAnnouncements } from "./announcements";
import { privacyReady } from "./auth/config";
import { publicCompetition } from "./public-competition";
import { projectPublicNews, type OfficialNewsEvent } from "./public-news-model";
async function loadNews(now: Date) {
  const editions = await readTournaments(true);
  const events: OfficialNewsEvent[] = [];
  if (editions.length) {
    const pools = await db()
      .select({
        id: mappools.id,
        slug: mappools.editionSlug,
        name: mappools.name,
        at: mappools.publishedAt,
        round: tournamentRounds.name,
      })
      .from(mappools)
      .innerJoin(tournamentRounds, eq(tournamentRounds.id, mappools.roundId))
      .where(
        and(
          isNotNull(mappools.publishedAt),
          inArray(
            mappools.editionSlug,
            editions.map((r) => r.edition.slug),
          ),
        ),
      );
    events.push(
      ...pools.map((p) => ({
        editionSlug: p.slug,
        kind: "mappool" as const,
        id: p.id,
        title: `Mappool released: ${p.name}`,
        summary: `${p.name} for ${p.round} is published. View the released beatmaps and slot configuration.`,
        at: p.at!.toISOString(),
        url: `/tournaments/${p.slug}/mappools/${p.id}`,
      })),
    );
    // Reuse the existing privacy/progression projection; never publish imported or unapproved scores.
    const competitions = await Promise.all(
      editions.map(async ({ edition }) => ({
        slug: edition.slug,
        data: await publicCompetition(edition.slug),
      })),
    );
    for (const { slug, data } of competitions)
      for (const f of data?.fixtures ?? []) {
        events.push({
          editionSlug: slug,
          kind: "fixture",
          id: f.id,
          title: `Fixture published: ${f.label}`,
          summary: `${f.roundName}: ${f.home.label} vs ${f.away.label}. ${f.scheduledAt ? `Scheduled for ${new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: f.timeZone }).format(new Date(f.scheduledAt))} (${f.timeZone}).` : "Match time is to be announced."} A published fixture does not establish a completed result.`,
          at: f.publishedAt,
          url: `/tournaments/${slug}/matches/${f.id}`,
        });
        if (f.result)
          events.push({
            editionSlug: slug,
            kind: "result",
            id: f.id,
            title: `Result published: ${f.label}`,
            summary: `${f.roundName}: ${f.home.label} ${f.result.homeWins}–${f.result.awayWins} ${f.away.label}. View the approved match result and latest published updates.`,
            at: f.result.updatedAt,
            url: `/tournaments/${slug}/matches/${f.id}`,
          });
      }
  }
  return {
    editions: editions.map((r) => r.edition),
    items: projectPublicNews(
      editions,
      events,
      getAnnouncements(),
      privacyReady(),
      now,
    ),
  };
}
// Request-scoped memoization only: fresh requests reflect time windows, retractions and corrections.
const requestNews = cache(() => loadNews(new Date()));
export function publicNewsContext(now?: Date) {
  return now ? loadNews(now) : requestNews();
}
export async function publicNews(now?: Date) {
  return (await publicNewsContext(now)).items;
}
export async function publicNewsItem(slug: string, now?: Date) {
  return (await publicNews(now)).find((item) => item.slug === slug);
}
