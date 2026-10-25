import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { sessions, users } from "@/db/schema";
import { hashToken, randomToken, validToken } from "./tokens";
export async function createSession(userId: number) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + 7 * 86400000);
  await db()
    .insert(sessions)
    .values({ tokenHash: hashToken(token), userId, expiresAt });
  return { token, expiresAt };
}
export async function readSession(token: string | undefined) {
  if (!validToken(token)) return null;
  const [row] = await db()
    .select({ osuId: users.osuId, username: users.username })
    .from(sessions)
    .innerJoin(users, eq(users.osuId, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}
/** Server-only session context for delegated credential management. */
export async function readSessionContext(token: string | undefined) {
  if (!validToken(token)) return null;
  const [row] = await db()
    .select({
      osuId: users.osuId,
      username: users.username,
      tokenHash: sessions.tokenHash,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.osuId, sessions.userId))
    .where(
      and(
        eq(sessions.tokenHash, hashToken(token)),
        gt(sessions.expiresAt, new Date()),
      ),
    )
    .limit(1);
  return row ?? null;
}
export type BrowserSessionContext = NonNullable<
  Awaited<ReturnType<typeof readSessionContext>>
>;
export async function revokeSession(token: string | undefined) {
  if (validToken(token))
    await db()
      .delete(sessions)
      .where(eq(sessions.tokenHash, hashToken(token)));
}
export type User = NonNullable<Awaited<ReturnType<typeof readSession>>>;
