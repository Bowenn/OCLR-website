import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { editionState, draftSessions } from "@/db/schema";
/** Read inside the edition transaction for mutations. Enrollment uses its own
 * persisted pause and is deliberately independent from this structural guard. */
export async function draftSetupProtection(
  reader: Pick<ReturnType<typeof db>, "select">,
  slug: string,
) {
  const [row] = await reader
    .select({
      lockedAt: editionState.lockedAt,
      state: draftSessions.state,
      hasPicks: sql<boolean>`EXISTS(SELECT 1 FROM draft_picks p JOIN draft_sessions s ON s.id=p.session_id WHERE s.edition_slug=${slug} AND p.voided_at IS NULL)`,
      finalized: sql<boolean>`EXISTS(SELECT 1 FROM teams t WHERE t.edition_slug=${slug} AND t.finalized_at IS NOT NULL)`,
    })
    .from(editionState)
    .leftJoin(draftSessions, eq(draftSessions.editionSlug, editionState.slug))
    .where(eq(editionState.slug, slug));
  const locked =
    !row ||
    Boolean(row.lockedAt) ||
    row.finalized ||
    Boolean(row.state && !["setup", "paused", "aborted"].includes(row.state));
  return {
    locked,
    captainsLocked: locked || Boolean(row?.hasPicks),
    hasPicks: Boolean(row?.hasPicks),
  };
}
