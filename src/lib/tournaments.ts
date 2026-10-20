import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { editionState } from "@/db/schema";
import { editionSchema } from "./editions";
type Reader = Pick<ReturnType<typeof db>, "select">;
export function storedEdition(row: typeof editionState.$inferSelect) {
  if (!row.configuration) return undefined;
  return {
    edition: editionSchema.parse({ ...row.configuration, slug: row.slug }),
    revision: row.configurationVersion,
    createdAt: row.createdAt,
    updatedAt: row.configurationUpdatedAt,
    locked: Boolean(row.lockedAt),
  };
}
export async function readTournament(
  slug: string,
  reader: Reader = db(),
  publicOnly = false,
) {
  const [row] = await reader
    .select()
    .from(editionState)
    .where(
      and(
        eq(editionState.slug, slug),
        isNotNull(editionState.configuration),
        publicOnly
          ? sql`${editionState.configuration}->>'published' = 'true'`
          : undefined,
      ),
    );
  return row ? storedEdition(row) : undefined;
}
export async function readTournaments(publicOnly = false) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await db()
    .select()
    .from(editionState)
    .where(
      and(
        isNotNull(editionState.configuration),
        publicOnly
          ? sql`${editionState.configuration}->>'published' = 'true'`
          : undefined,
      ),
    )
    .orderBy(editionState.configurationUpdatedAt, editionState.slug);
  return rows.map((row) => storedEdition(row)!);
}
