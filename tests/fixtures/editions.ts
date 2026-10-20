import { assertTestDatabase } from "../database";
import { sql } from "drizzle-orm";
import { db } from "../../src/db";
import { editionRevisions, editionState } from "../../src/db/schema";
import { editionSchema, type Edition } from "../../src/lib/editions";
import { edition } from "./edition";
/** Explicit isolated DB fixtures only; never an application seed or read fallback. */
export async function seedEditions(
  values: unknown[] = [edition],
  replace = true,
) {
  assertTestDatabase(process.env.TEST_DATABASE_URL);
  for (const value of values) {
    const { slug, ...configuration } = editionSchema.parse(value);
    await db()
      .insert(editionState)
      .values({ slug, configuration })
      .onConflictDoUpdate({
        target: editionState.slug,
        set: { configuration, configurationVersion: 0 },
        where: replace ? undefined : sql`${editionState.configuration} IS NULL`,
      });
    await db()
      .insert(editionRevisions)
      .values({ editionSlug: slug, version: 0, configuration })
      .onConflictDoUpdate({
        target: [editionRevisions.editionSlug, editionRevisions.version],
        set: { configuration },
        where: replace ? undefined : sql`false`,
      });
  }
}
export type { Edition };
