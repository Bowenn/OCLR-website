import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import { editionState, users } from "../../src/db/schema";
import { createSession } from "../../src/lib/auth/sessions";
export async function seedSession(id: number) {
  const url = process.env.TEST_DATABASE_URL;
  if (!url || !new URL(url).pathname.includes("test"))
    throw new Error("An isolated TEST_DATABASE_URL is required");
  process.env.DATABASE_URL = url;
  await db().delete(users).where(eq(users.osuId, id));
  await db()
    .insert(users)
    .values({ osuId: id, username: `Synthetic Player ${id}` });
  await db()
    .insert(editionState)
    .values({ slug: "test-cup" })
    .onConflictDoUpdate({ target: editionState.slug, set: { lockedAt: null } });
  const session = await createSession(id);
  return {
    name: "oclr_session",
    value: session.token,
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    sameSite: "Lax" as const,
    secure: false,
  };
}
