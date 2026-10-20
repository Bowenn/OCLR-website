import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { captains, memberships, teams, users } from "@/db/schema";
import { getPublicEditions } from "./content";
import { HttpError } from "./http";
import { parseOsuProfile } from "./osu-profile-model";
const filtersSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    edition: z
      .string()
      .regex(/^[a-z0-9-]*$/)
      .max(80)
      .default(""),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
type PublishedPlayer = {
  osuId: number;
  username: string;
  editionSlug: string;
  editionName: string;
  team: { id: string; name: string } | null;
  captain: boolean;
  participation: "captain" | "finalized_roster";
};
export async function publicPlayers(input: unknown, exactOsuId?: number) {
  const parsed = filtersSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Choose a valid player search, edition and page.");
  const filters = parsed.data;
  if (filters.q.startsWith("https://"))
    filters.q = String(parseOsuProfile(filters.q).osuId);
  const editions = (await getPublicEditions()).filter(
    (e) => !filters.edition || filters.edition === e.slug,
  );
  const empty = { rows: [] as PublishedPlayer[], total: 0, filters };
  if (!editions.length || !process.env.DATABASE_URL) return empty;
  const slugs = editions.map((e) => e.slug);
  return db().transaction(
    async (tx) => {
      // Publication is enforced here, before data reaches a page or an API response.
      // Private registrations, answers, notes and rejection reasons are never queried.
      const publishedCaptains = await tx
        .select({
          osuId: users.osuId,
          username: users.username,
          editionSlug: captains.editionSlug,
          teamId: teams.id,
          teamName: teams.name,
        })
        .from(captains)
        .innerJoin(users, eq(users.osuId, captains.userId))
        .leftJoin(
          teams,
          and(
            eq(teams.editionSlug, captains.editionSlug),
            eq(teams.captainId, captains.userId),
            eq(teams.identityPublished, true),
            isNull(teams.archivedAt),
          ),
        )
        .where(
          and(
            inArray(captains.editionSlug, slugs),
            eq(captains.published, true),
          ),
        );
      const roster = await tx
        .select({
          osuId: users.osuId,
          username: users.username,
          editionSlug: teams.editionSlug,
          teamId: teams.id,
          teamName: teams.name,
          captainId: teams.captainId,
        })
        .from(teams)
        .innerJoin(
          captains,
          and(
            eq(captains.editionSlug, teams.editionSlug),
            eq(captains.userId, teams.captainId),
            eq(captains.published, true),
          ),
        )
        .innerJoin(
          memberships,
          and(eq(memberships.teamId, teams.id), isNull(memberships.leftAt)),
        )
        .innerJoin(users, eq(users.osuId, memberships.userId))
        .where(
          and(
            inArray(teams.editionSlug, slugs),
            eq(teams.identityPublished, true),
            eq(teams.rosterPublished, true),
            isNotNull(teams.finalizedAt),
            isNull(teams.archivedAt),
          ),
        );
      const byIdentity = new Map<string, PublishedPlayer>();
      for (const p of publishedCaptains)
        byIdentity.set(`${p.editionSlug}:${p.osuId}`, {
          osuId: p.osuId,
          username: p.username,
          editionSlug: p.editionSlug,
          editionName: editions.find((e) => e.slug === p.editionSlug)!.name,
          team: p.teamId ? { id: p.teamId, name: p.teamName! } : null,
          captain: true,
          participation: "captain",
        });
      for (const p of roster)
        byIdentity.set(`${p.editionSlug}:${p.osuId}`, {
          osuId: p.osuId,
          username: p.username,
          editionSlug: p.editionSlug,
          editionName: editions.find((e) => e.slug === p.editionSlug)!.name,
          team: { id: p.teamId, name: p.teamName },
          captain: p.osuId === p.captainId,
          participation: "finalized_roster",
        });
      const q = filters.q.toLowerCase();
      const matching = [...byIdentity.values()]
        .filter((p) =>
          exactOsuId
            ? p.osuId === exactOsuId
            : p.username.toLowerCase().includes(q) || String(p.osuId) === q,
        )
        .sort(
          (a, b) =>
            a.editionName.localeCompare(b.editionName) ||
            a.username.localeCompare(b.username) ||
            a.osuId - b.osuId,
        );
      return {
        rows: exactOsuId
          ? matching
          : matching.slice((filters.page - 1) * 24, filters.page * 24),
        total: matching.length,
        filters,
      };
    },
    { isolationLevel: "repeatable read" },
  );
}
export async function publicPlayer(osuId: number) {
  return (await publicPlayers({}, osuId)).rows;
}
