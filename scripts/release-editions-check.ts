import { sql } from "drizzle-orm";
import { db } from "../src/db";

/** Deleted drafts retain NULL configurations and their immutable audit/slug anchors. */
export async function assertEditionConfigurationsReady(database = db()) {
  const missing = await database.execute(sql`
    SELECT state.slug FROM edition_state AS state
    WHERE state.configuration IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM edition_events AS event
        WHERE event.edition_slug = state.slug
          AND event.kind = 'tournament_delete_draft'
          AND event.detail @> jsonb_build_object(
            'entity', jsonb_build_object('type', 'tournament', 'id', state.slug),
            'after', jsonb_build_object(
              'configuration', NULL, 'revision', state.configuration_version
            )
          )
      )
    LIMIT 1
  `);
  if (missing.rows.length)
    throw new Error(
      "Legacy edition anchors need an approved one-time configuration import before release.",
    );
}
