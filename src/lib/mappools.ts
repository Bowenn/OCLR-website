import { and, desc, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  editionState,
  fixtures,
  resultRevisions,
  tournamentStages,
  tournamentRounds,
  mappools,
  mappoolEntries,
  mappoolEvents,
} from "@/db/schema";
import { assertCapability } from "./auth/staff";
import type { User } from "./auth/sessions";
import { getEditions, getPublicEdition } from "./content";
import { fetchBeatmap } from "./osu-beatmaps";
import { HttpError } from "./http";
import {
  categories,
  parseBeatmapId,
  type BeatmapMetadata,
} from "./mappool-model";
const confirmation = {
  confirmed: z.literal(true),
};
const versioned = {
  poolId: z.uuid(),
  expectedVersion: z.number().int().nonnegative(),
};
const name = z.string().trim().min(1).max(80);
const position = z.number().int().min(1).max(999);
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...confirmation,
      action: z.literal("round_create"),
      stage: z.enum(["group", "knockout"]),
      name,
      position,
    })
    .strict(),
  z
    .object({
      ...confirmation,
      action: z.literal("round_edit"),
      roundId: z.uuid(),
      expectedVersion: z.number().int().nonnegative(),
      name,
      position,
    })
    .strict(),
  z
    .object({
      ...confirmation,
      action: z.literal("pool_create"),
      roundId: z.uuid(),
      name,
    })
    .strict(),
  z
    .object({
      ...confirmation,
      ...versioned,
      action: z.literal("pool_settings"),
      name,
      fmMode: z.enum(["free_mod", "force_mod"]).nullable(),
      fmRestrictions: z.string().trim().max(2000),
    })
    .strict(),
  z
    .object({
      ...confirmation,
      ...versioned,
      action: z.literal("pool_publish"),
      published: z.boolean(),
    })
    .strict(),
  z
    .object({
      ...confirmation,
      ...versioned,
      action: z.literal("entry_save"),
      expectedMetadataFingerprint: z
        .string()
        .regex(/^[a-f0-9]{64}$/)
        .optional(),
      entryId: z.uuid().nullable(),
      beatmap: z.string().trim().min(1).max(250),
      category: z.enum(categories),
      position,
    })
    .strict(),
  z
    .object({
      ...confirmation,
      ...versioned,
      action: z.literal("entry_remove"),
      entryId: z.uuid(),
    })
    .strict(),
  z
    .object({
      ...confirmation,
      ...versioned,
      action: z.literal("entry_refresh"),
      entryId: z.uuid(),
    })
    .strict(),
  z
    .object({
      ...confirmation,
      ...versioned,
      action: z.literal("reorder"),
      category: z.enum(categories),
      entryIds: z.array(z.uuid()).min(1).max(999),
    })
    .strict(),
]);
const roundFields = {
  id: tournamentRounds.id,
  name: tournamentRounds.name,
  stage: tournamentStages.kind,
  position: tournamentRounds.position,
  version: tournamentRounds.version,
};
const poolFields = {
  id: mappools.id,
  name: mappools.name,
  roundId: mappools.roundId,
  fmMode: mappools.fmMode,
  fmRestrictions: mappools.fmRestrictions,
  version: mappools.version,
  publishedAt: mappools.publishedAt,
  lockedAt: mappools.lockedAt,
  updatedAt: mappools.updatedAt,
};
export async function mappoolWorkspace(actor: User, slug: string) {
  await assertCapability(actor, "manage_mappools", slug);
  if (!getEditions().some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  return db().transaction(
    async (tx) => {
      const rounds = await tx
        .select(roundFields)
        .from(tournamentRounds)
        .innerJoin(
          tournamentStages,
          eq(tournamentStages.id, tournamentRounds.stageId),
        )
        .where(eq(tournamentRounds.editionSlug, slug))
        .orderBy(tournamentStages.kind, tournamentRounds.position);
      const pools = await tx
        .select(poolFields)
        .from(mappools)
        .where(eq(mappools.editionSlug, slug))
        .orderBy(mappools.name);
      const entries = pools.length
        ? await tx
            .select()
            .from(mappoolEntries)
            .where(
              inArray(
                mappoolEntries.poolId,
                pools.map((p) => p.id),
              ),
            )
            .orderBy(mappoolEntries.category, mappoolEntries.position)
        : [];
      const events = await tx
        .select()
        .from(mappoolEvents)
        .where(eq(mappoolEvents.editionSlug, slug))
        .orderBy(desc(mappoolEvents.createdAt))
        .limit(100);
      return { rounds, pools, entries, events };
    },
    { isolationLevel: "repeatable read" },
  );
}
export type MappoolWorkspace = Awaited<ReturnType<typeof mappoolWorkspace>>;
// Preview is a protected read, not a mutation. No registration or audit data is returned.
export async function previewBeatmap(
  actor: User,
  slug: string,
  input: unknown,
) {
  await assertCapability(actor, "manage_mappools", slug);
  if (!getEditions().some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  const parsed = z
    .object({ beatmap: z.string().trim().min(1).max(250) })
    .strict()
    .safeParse(input);
  const id = parsed.success ? parseBeatmapId(parsed.data.beatmap) : null;
  if (!id)
    throw new HttpError(
      400,
      "Enter an osu! beatmap ID or canonical difficulty URL.",
    );
  return fetchBeatmap(id);
}
export async function mappoolCommand(
  actor: User,
  slug: string,
  input: unknown,
) {
  await assertCapability(actor, "manage_mappools", slug);
  if (!getEditions().some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Confirm a valid mappool change.");
  const c = parsed.data;
  let metadata: BeatmapMetadata | undefined;
  let beatmapId: number | undefined;
  let metadataFetchedAt: Date | undefined;
  // Provider work happens before the transaction; the version is checked again under lock.
  if (c.action === "entry_save" || c.action === "entry_refresh") {
    const [pool] = await db()
      .select()
      .from(mappools)
      .where(and(eq(mappools.id, c.poolId), eq(mappools.editionSlug, slug)));
    if (!pool) throw new HttpError(404, "Mappool not found.");
    if (pool.version !== c.expectedVersion || pool.publishedAt || pool.lockedAt)
      throw new HttpError(
        409,
        "Refresh the pool. Published or completed-fixture pools cannot be edited.",
      );
    const [entry] = c.entryId
      ? await db()
          .select()
          .from(mappoolEntries)
          .where(
            and(
              eq(mappoolEntries.id, c.entryId),
              eq(mappoolEntries.poolId, pool.id),
            ),
          )
      : [];
    if (c.entryId && !entry) throw new HttpError(404, "Map slot not found.");
    beatmapId =
      c.action === "entry_save"
        ? (parseBeatmapId(c.beatmap) ?? undefined)
        : entry!.beatmapId;
    if (!beatmapId)
      throw new HttpError(
        400,
        "Enter an osu! beatmap ID or canonical difficulty URL.",
      );
    if (
      c.action === "entry_refresh" &&
      entry &&
      Date.now() - entry.metadataFetchedAt.getTime() < 60000
    )
      throw new HttpError(
        429,
        "Wait at least one minute between metadata refreshes.",
      );
    const snapshot = await fetchBeatmap(beatmapId);
    if (
      c.action === "entry_save" &&
      c.expectedMetadataFingerprint &&
      c.expectedMetadataFingerprint !== snapshot.fingerprint
    )
      throw new HttpError(
        409,
        "Official metadata changed after your preview. Look up the beatmap again before saving.",
      );
    metadata = snapshot.metadata;
    metadataFetchedAt = new Date(snapshot.fetchedAt);
  }
  try {
    await db().transaction(async (tx) => {
      // All pool/round changes for this edition share a lock, without touching draft versions.
      await tx.insert(editionState).values({ slug }).onConflictDoNothing();
      await tx
        .select()
        .from(editionState)
        .where(eq(editionState.slug, slug))
        .for("update");
      await assertCapability(actor, "manage_mappools", slug, tx);
      if (c.action === "round_create" || c.action === "round_edit") {
        let before = null;
        let round;
        if (c.action === "round_create") {
          const [stage] = await tx
            .insert(tournamentStages)
            .values({ editionSlug: slug, kind: c.stage })
            .onConflictDoUpdate({
              target: [tournamentStages.editionSlug, tournamentStages.kind],
              set: { kind: c.stage },
            })
            .returning();
          [round] = await tx
            .insert(tournamentRounds)
            .values({
              editionSlug: slug,
              stageId: stage.id,
              name: c.name,
              position: c.position,
            })
            .returning();
        } else {
          [before] = await tx
            .select()
            .from(tournamentRounds)
            .where(
              and(
                eq(tournamentRounds.id, c.roundId),
                eq(tournamentRounds.editionSlug, slug),
              ),
            );
          if (!before) throw new HttpError(404, "Round not found.");
          if (before.version !== c.expectedVersion)
            throw new HttpError(
              409,
              "The round changed. Refresh before editing.",
            );
          const used = await tx
            .select()
            .from(mappools)
            .where(
              and(
                eq(mappools.roundId, before.id),
                sql`(${mappools.publishedAt} IS NOT NULL OR ${mappools.lockedAt} IS NOT NULL)`,
              ),
            )
            .limit(1);
          const completed = await tx
            .select({ id: fixtures.id })
            .from(fixtures)
            .innerJoin(
              resultRevisions,
              eq(resultRevisions.fixtureId, fixtures.id),
            )
            .where(
              and(
                eq(fixtures.roundId, before.id),
                isNotNull(resultRevisions.approvedAt),
              ),
            )
            .limit(1);
          if (used.length || completed.length)
            throw new HttpError(
              409,
              "Published or completed-fixture round labels are protected. Unpublish editable pools first.",
            );
          [round] = await tx
            .update(tournamentRounds)
            .set({
              name: c.name,
              position: c.position,
              version: before.version + 1,
            })
            .where(eq(tournamentRounds.id, before.id))
            .returning();
        }
        await tx.insert(mappoolEvents).values({
          editionSlug: slug,
          actorId: actor.osuId,
          action: c.action,

          before,
          after: round,
        });
        return;
      }
      if (c.action === "pool_create") {
        const [round] = await tx
          .select()
          .from(tournamentRounds)
          .where(
            and(
              eq(tournamentRounds.id, c.roundId),
              eq(tournamentRounds.editionSlug, slug),
            ),
          );
        if (!round)
          throw new HttpError(404, "Round not found in this edition.");
        const [pool] = await tx
          .insert(mappools)
          .values({ editionSlug: slug, roundId: round.id, name: c.name })
          .returning();
        await tx.insert(mappoolEvents).values({
          editionSlug: slug,
          poolId: pool.id,
          actorId: actor.osuId,
          action: c.action,

          after: pool,
        });
        return;
      }
      const [pool] = await tx
        .select()
        .from(mappools)
        .where(and(eq(mappools.id, c.poolId), eq(mappools.editionSlug, slug)))
        .for("update");
      if (!pool) throw new HttpError(404, "Mappool not found.");
      if (pool.version !== c.expectedVersion)
        throw new HttpError(
          409,
          "This pool changed. Refresh before confirming.",
        );
      if (c.action !== "pool_publish" && (pool.publishedAt || pool.lockedAt))
        throw new HttpError(
          409,
          "Unpublish before editing. A pool used by a completed fixture is immutable; create a new pool instead.",
        );
      const entries = await tx
        .select()
        .from(mappoolEntries)
        .where(eq(mappoolEntries.poolId, pool.id));
      const before = { pool, entries };
      if (c.action === "pool_settings") {
        if (!c.fmMode && entries.some((e) => e.category === "FM"))
          throw new HttpError(409, "Remove FM slots before disabling FM.");
        await tx
          .update(mappools)
          .set({
            name: c.name,
            fmMode: c.fmMode,
            fmRestrictions: c.fmMode ? c.fmRestrictions : "",
          })
          .where(eq(mappools.id, pool.id));
      } else if (c.action === "pool_publish") {
        if (c.published && !entries.length)
          throw new HttpError(409, "Add a verified map before publishing.");
        await tx
          .update(mappools)
          .set({ publishedAt: c.published ? new Date() : null })
          .where(eq(mappools.id, pool.id));
      } else if (c.action === "reorder") {
        const group = entries.filter((e) => e.category === c.category);
        if (
          new Set(c.entryIds).size !== c.entryIds.length ||
          group.length !== c.entryIds.length ||
          !group.every((e) => c.entryIds.includes(e.id))
        )
          throw new HttpError(
            400,
            "Reorder every slot in this category exactly once.",
          );
        for (let i = 0; i < c.entryIds.length; i++)
          await tx
            .update(mappoolEntries)
            .set({ position: 10000 + i })
            .where(eq(mappoolEntries.id, c.entryIds[i]));
        for (let i = 0; i < c.entryIds.length; i++)
          await tx
            .update(mappoolEntries)
            .set({ position: i + 1 })
            .where(eq(mappoolEntries.id, c.entryIds[i]));
      } else {
        const entry = entries.find((e) => e.id === c.entryId);
        if (c.entryId && !entry)
          throw new HttpError(404, "Map slot not found in this pool.");
        if (c.action === "entry_remove")
          await tx
            .delete(mappoolEntries)
            .where(eq(mappoolEntries.id, c.entryId));
        else if (c.action === "entry_refresh")
          await tx
            .update(mappoolEntries)
            .set({ metadata: metadata!, metadataFetchedAt: metadataFetchedAt! })
            .where(eq(mappoolEntries.id, c.entryId));
        else {
          if (c.category === "FM" && !pool.fmMode)
            throw new HttpError(
              409,
              "Choose Free Mod or Force Mod before adding FM slots.",
            );
          const values = {
            category: c.category,
            position: c.position,
            beatmapId: beatmapId!,
            metadata: metadata!,
            metadataFetchedAt: metadataFetchedAt!,
          };
          if (entry)
            await tx
              .update(mappoolEntries)
              .set(values)
              .where(eq(mappoolEntries.id, entry.id));
          else
            await tx
              .insert(mappoolEntries)
              .values({ poolId: pool.id, ...values });
        }
      }
      const [afterPool] = await tx
        .update(mappools)
        .set({ version: pool.version + 1, updatedAt: new Date() })
        .where(eq(mappools.id, pool.id))
        .returning();
      const afterEntries = await tx
        .select()
        .from(mappoolEntries)
        .where(eq(mappoolEntries.poolId, pool.id))
        .orderBy(mappoolEntries.category, mappoolEntries.position);
      await tx.insert(mappoolEvents).values({
        editionSlug: slug,
        poolId: pool.id,
        actorId: actor.osuId,
        action: c.action,

        before,
        after: { pool: afterPool, entries: afterEntries },
      });
    });
  } catch (error) {
    const cause = error instanceof Error ? error.cause : undefined;
    if ((cause as { code?: string })?.code === "23505")
      throw new HttpError(
        409,
        "This round position, pool name or map slot already exists. Refresh and choose another.",
      );
    throw error;
  }
  return mappoolWorkspace(actor, slug);
}
export async function publicMappools(slug: string, poolId?: string) {
  if (!getPublicEdition(slug) || !process.env.DATABASE_URL) return [];
  if (poolId && !z.uuid().safeParse(poolId).success) return [];
  return db().transaction(
    async (tx) => {
      const pools = await tx
        .select({
          id: mappools.id,
          name: mappools.name,
          roundId: mappools.roundId,
          fmMode: mappools.fmMode,
          fmRestrictions: mappools.fmRestrictions,
          publishedAt: mappools.publishedAt,
          updatedAt: mappools.updatedAt,
          roundName: tournamentRounds.name,
          roundPosition: tournamentRounds.position,
          stage: tournamentStages.kind,
        })
        .from(mappools)
        .innerJoin(tournamentRounds, eq(tournamentRounds.id, mappools.roundId))
        .innerJoin(
          tournamentStages,
          eq(tournamentStages.id, tournamentRounds.stageId),
        )
        .where(
          and(
            eq(mappools.editionSlug, slug),
            isNotNull(mappools.publishedAt),
            poolId ? eq(mappools.id, poolId) : undefined,
          ),
        )
        .orderBy(
          tournamentStages.kind,
          tournamentRounds.position,
          mappools.name,
        );
      const entries = pools.length
        ? await tx
            .select({
              id: mappoolEntries.id,
              poolId: mappoolEntries.poolId,
              category: mappoolEntries.category,
              position: mappoolEntries.position,
              beatmapId: mappoolEntries.beatmapId,
              metadata: mappoolEntries.metadata,
            })
            .from(mappoolEntries)
            .where(
              inArray(
                mappoolEntries.poolId,
                pools.map((p) => p.id),
              ),
            )
            .orderBy(mappoolEntries.category, mappoolEntries.position)
        : [];
      return pools.map((p) => ({
        ...p,
        entries: entries.filter((e) => e.poolId === p.id),
      }));
    },
    { isolationLevel: "repeatable read" },
  );
}
