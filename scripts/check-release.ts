import { z } from "zod";
import { appUrl } from "../src/lib/http";
import { authReady, oauthConfig } from "../src/lib/auth/config";
import { getAnnouncements } from "../src/lib/announcements";
import { getBrackets } from "../src/lib/brackets";
import { getEditions } from "../src/lib/content";
import { db, closeDb } from "../src/db";
import { sql } from "drizzle-orm";
try {
  if (!authReady())
    throw new Error(
      "Required origin, database, osu! credentials or approved privacy configuration is missing.",
    );
  if (!appUrl().startsWith("https://"))
    throw new Error("Release requires HTTPS.");
  oauthConfig();
  const ids = (process.env.STAFF_OSU_IDS ?? "").split(",").map((v) => v.trim());
  if (
    !ids.length ||
    ids.some(
      (id) => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)),
    )
  )
    throw new Error("Configure verified staff osu! IDs.");
  for (const e of getEditions()) {
    if (e.published && e.registration && (!e.rules || !e.eligibility))
      throw new Error(
        "Published registration requires approved rules and eligibility disclosure.",
      );
  }
  getBrackets();
  getAnnouncements();
  z.email().parse(process.env.PRIVACY_CONTACT_EMAIL);
  await db().execute(sql`SELECT 1 FROM users LIMIT 0`);
  await db().execute(sql`SELECT 1 FROM registrations LIMIT 0`);
  console.log(
    "Configuration and database preflight passed. Live OAuth, deployment and organizer approval must still be verified.",
  );
} catch (error) {
  console.error(
    error instanceof Error ? error.message : "Release preflight failed.",
  );
  process.exitCode = 1;
} finally {
  await closeDb();
}
