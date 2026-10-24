import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  editionState,
  playerMessages,
  registrations,
  users,
} from "@/db/schema";
import type { User } from "./auth/sessions";
import { HttpError } from "./http";

export type PlayerMessage = {
  id: string;
  authorId: number;
  author: string;
  text: string;
  createdAt: string;
};
const inputSchema = z
  .object({ requestId: z.uuid(), text: z.string().trim().min(1).max(1000) })
  .strict();
const visible = (edition: string, playerId: number) =>
  and(
    eq(registrations.editionSlug, edition),
    eq(registrations.userId, playerId),
    eq(registrations.status, "accepted"),
    sql`${editionState.configuration}->>'published' = 'true'`,
  );
export async function publicPlayerMessages(
  edition: string,
  playerId: number,
): Promise<PlayerMessage[]> {
  const rows = await db()
    .select({
      id: playerMessages.id,
      authorId: users.osuId,
      author: users.username,
      text: playerMessages.body,
      createdAt: playerMessages.createdAt,
    })
    .from(playerMessages)
    .innerJoin(users, eq(users.osuId, playerMessages.authorId))
    .innerJoin(
      registrations,
      and(
        eq(registrations.userId, playerMessages.playerId),
        eq(registrations.editionSlug, playerMessages.editionSlug),
      ),
    )
    .innerJoin(editionState, eq(editionState.slug, registrations.editionSlug))
    .where(
      and(
        eq(playerMessages.editionSlug, edition),
        eq(playerMessages.playerId, playerId),
        visible(edition, playerId),
      ),
    )
    .orderBy(desc(playerMessages.createdAt), desc(playerMessages.id))
    .limit(20);
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
  }));
}
export async function postPlayerMessage(
  actor: User,
  edition: string,
  playerId: number,
  input: unknown,
) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success || !Number.isSafeInteger(playerId) || playerId <= 0)
    throw new HttpError(400, "Enter a message of 1 to 1000 characters.");
  return db().transaction(async (tx) => {
    // Serialize one author's writes across targets; duplicate retries do not count toward the limit.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended(${`player-message:${actor.osuId}`}, 0))`,
    );
    const [target] = await tx
      .select({ id: registrations.id })
      .from(registrations)
      .innerJoin(editionState, eq(editionState.slug, registrations.editionSlug))
      .where(visible(edition, playerId))
      .for("share");
    if (!target) throw new HttpError(404, "Published player not found.");
    const [existing] = await tx
      .select()
      .from(playerMessages)
      .where(
        and(
          eq(playerMessages.authorId, actor.osuId),
          eq(playerMessages.requestId, parsed.data.requestId),
        ),
      );
    if (existing) {
      if (
        existing.editionSlug !== edition ||
        existing.playerId !== playerId ||
        existing.body !== parsed.data.text
      )
        throw new HttpError(409, "This message request has already been used.");
      return { id: existing.id };
    }
    const [recent] = await tx
      .select({ total: sql<number>`count(*)::int` })
      .from(playerMessages)
      .where(
        and(
          eq(playerMessages.authorId, actor.osuId),
          sql`${playerMessages.createdAt} > now() - interval '1 minute'`,
        ),
      );
    if (recent.total >= 5)
      throw new HttpError(429, "Please wait before posting another message.");
    const [saved] = await tx
      .insert(playerMessages)
      .values({
        editionSlug: edition,
        playerId,
        authorId: actor.osuId,
        requestId: parsed.data.requestId,
        body: parsed.data.text,
      })
      .returning({ id: playerMessages.id });
    return saved;
  });
}

/** Only the explicitly selected text answer is projected; never return a questionnaire. */
export async function publicPlayerIntroductions(
  edition: string,
  ids: number[],
  questionId?: string | null,
) {
  if (!questionId || !ids.length) return new Map<number, string>();
  const rows = await db()
    .select({
      playerId: registrations.userId,
      bio: sql<string | null>`${registrations.answers}->>${questionId}`,
    })
    .from(registrations)
    .innerJoin(editionState, eq(editionState.slug, registrations.editionSlug))
    .where(
      and(
        eq(registrations.editionSlug, edition),
        inArray(registrations.userId, ids),
        eq(registrations.status, "accepted"),
        sql`${editionState.configuration}->>'published' = 'true'`,
        sql`${editionState.configuration}->'registration'->>'publicIntroductionQuestionId' = ${questionId}`,
      ),
    );
  return new Map(
    rows
      .filter((r) => typeof r.bio === "string")
      .map((r) => [r.playerId, r.bio!]),
  );
}
