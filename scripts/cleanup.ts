import { lt } from "drizzle-orm";
import { db, closeDb } from "../src/db";
import { oauthStates, sessions } from "../src/db/schema";
try {
  await db().delete(oauthStates).where(lt(oauthStates.expiresAt, new Date()));
  await db().delete(sessions).where(lt(sessions.expiresAt, new Date()));
  console.log("Expired OAuth and session records removed.");
} finally {
  await closeDb();
}
