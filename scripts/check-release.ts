import { z } from "zod";
import { appUrl } from "../src/lib/http";
import { authReady, oauthConfig } from "../src/lib/auth/config";
import { getAnnouncements } from "../src/lib/announcements";
import { getBrackets } from "../src/lib/brackets";
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
  const ids = (process.env.ADMIN_OSU_IDS ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
  if (
    ids.some(
      (id) => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)),
    )
  )
    throw new Error("Configure valid verified bootstrap Admin osu! IDs.");
  const globalAdmins = await db().execute(
    sql`SELECT 1 FROM staff_roles WHERE role = 'admin' AND edition_slug IS NULL AND revoked_at IS NULL LIMIT 1`,
  );
  if (!ids.length && !globalAdmins.rows.length)
    throw new Error("Provision a verified global Admin before release.");
  await db().execute(
    sql`SELECT configuration, configuration_version FROM edition_state LIMIT 0`,
  );
  const missing = await db().execute(
    sql`SELECT slug FROM edition_state WHERE configuration IS NULL LIMIT 1`,
  );
  if (missing.rows.length)
    throw new Error(
      "Legacy edition anchors need an approved one-time configuration import before release.",
    );
  getBrackets();
  getAnnouncements();
  z.email().parse(process.env.PRIVACY_CONTACT_EMAIL);
  await db().execute(sql`SELECT 1 FROM users LIMIT 0`);
  await db().execute(
    sql`SELECT osu_id, mode, profile, attempted_at, retry_at, refresh_token, error_status FROM user_profile_cache LIMIT 0`,
  );
  await db().execute(
    sql`SELECT eligibility_acknowledged FROM registrations LIMIT 0`,
  );
  await db().execute(sql`SELECT before, after FROM staff_role_events LIMIT 0`);
  await db().execute(
    sql`SELECT 1 FROM captains, teams, memberships, draft_sessions, draft_picks, edition_events LIMIT 0`,
  );
  await db().execute(
    sql`SELECT 1 FROM staff_role_events, tournament_stages, tournament_rounds, mappools, mappool_entries, mappool_events LIMIT 0`,
  );
  await db().execute(
    sql`SELECT 1 FROM fixtures, fixture_referees, match_imports, match_games, match_results, result_revisions, result_audit_events, result_game_claims LIMIT 0`,
  );
  await db().execute(sql`SELECT latest_import_id FROM match_results LIMIT 0`);
  await db().execute(
    sql`SELECT request_key, request_hash FROM result_audit_events LIMIT 0`,
  );
  await db().execute(
    sql`SELECT group_configuration, groups_published_at FROM tournament_stages LIMIT 0`,
  );
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
