import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  captains,
  editionEvents,
  editionState,
  registrations,
  users,
} from "@/db/schema";
import { getEditions, getPublicEdition } from "./content";
import { assertStaff } from "./auth/staff";
import type { User } from "./auth/sessions";
import { HttpError } from "./http";
const id = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const commands = z.discriminatedUnion("action", [
  z.object({ action: z.literal("appoint"), userId: id }).strict(),
  z.object({ action: z.literal("revoke"), userId: id }).strict(),
  z
    .object({ action: z.literal("replace"), userId: id, previousUserId: id })
    .strict(),
  z
    .object({
      action: z.literal("order"),
      userIds: z.array(id).min(1).max(256),
    })
    .strict(),
  z
    .object({
      action: z.literal("availability"),
      userId: id,
      available: z.boolean(),
    })
    .strict(),
  z.object({ action: z.literal("lock") }).strict(),
  z
    .object({
      action: z.literal("publish"),
      published: z.boolean(),
      poolPublished: z.boolean(),
    })
    .strict(),
]);
const commandSchema = z
  .object({
    command: commands,
    expectedVersion: z.number().int().nonnegative(),
    reason: z.string().trim().min(1).max(1000),
    confirmed: z.literal(true),
  })
  .strict();
export async function captainSetup(actor: User, slug: string) {
  assertStaff(actor);
  if (!getEditions().some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  return db().transaction(
    async (tx) => {
      const [state] = await tx
        .select()
        .from(editionState)
        .where(eq(editionState.slug, slug));
      const appointed = await tx
        .select({
          userId: captains.userId,
          username: users.username,
          position: captains.position,
          published: captains.published,
        })
        .from(captains)
        .innerJoin(users, eq(captains.userId, users.osuId))
        .where(eq(captains.editionSlug, slug))
        .orderBy(captains.position);
      const candidates = await tx
        .select({
          userId: registrations.userId,
          username: users.username,
          unavailableReason: registrations.draftUnavailableReason,
        })
        .from(registrations)
        .innerJoin(users, eq(registrations.userId, users.osuId))
        .where(
          and(
            eq(registrations.editionSlug, slug),
            eq(registrations.status, "accepted"),
          ),
        )
        .orderBy(users.username);
      return {
        version: state?.setupVersion ?? 0,
        locked: Boolean(state?.lockedAt),
        poolPublished: state?.poolPublished ?? false,
        captains: appointed,
        candidates,
        pool: candidates.filter(
          (c) =>
            !c.unavailableReason &&
            !appointed.some((a) => a.userId === c.userId),
        ),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}
export async function updateCaptains(
  actor: User,
  slug: string,
  input: unknown,
) {
  assertStaff(actor);
  if (!getEditions().some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      400,
      "Confirm a valid captain setup action and reason.",
    );
  const { command, expectedVersion, reason } = parsed.data;
  await db().transaction(async (tx) => {
    await tx.insert(editionState).values({ slug }).onConflictDoNothing();
    const [state] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    if (state.setupVersion !== expectedVersion)
      throw new HttpError(409, "Setup changed. Refresh before continuing.");
    if (state.lockedAt && command.action !== "publish")
      throw new HttpError(
        409,
        "Draft setup is locked. Changes require supervised draft recovery.",
      );
    const before = await tx
      .select()
      .from(captains)
      .where(eq(captains.editionSlug, slug))
      .orderBy(captains.position);
    if (command.action === "appoint" || command.action === "replace") {
      const [eligible] = await tx
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.editionSlug, slug),
            eq(registrations.userId, command.userId),
            eq(registrations.status, "accepted"),
          ),
        );
      if (
        !eligible ||
        eligible.draftUnavailableReason ||
        before.some((c) => c.userId === command.userId)
      )
        throw new HttpError(
          409,
          "Choose an accepted, available player who is not already a captain.",
        );
      let position = before.length
        ? Math.max(...before.map((c) => c.position)) + 1
        : 0;
      if (command.action === "replace") {
        const previous = before.find(
          (c) => c.userId === command.previousUserId,
        );
        if (!previous) throw new HttpError(409, "Captain not found.");
        position = previous.position;
        await tx
          .delete(captains)
          .where(
            and(
              eq(captains.editionSlug, slug),
              eq(captains.userId, command.previousUserId),
            ),
          );
      }
      await tx
        .insert(captains)
        .values({ editionSlug: slug, userId: command.userId, position });
    } else if (command.action === "revoke") {
      if (!before.some((c) => c.userId === command.userId))
        throw new HttpError(409, "Captain not found.");
      await tx
        .delete(captains)
        .where(
          and(
            eq(captains.editionSlug, slug),
            eq(captains.userId, command.userId),
          ),
        );
    } else if (command.action === "order") {
      if (
        new Set(command.userIds).size !== before.length ||
        command.userIds.length !== before.length ||
        before.some((c) => !command.userIds.includes(c.userId))
      )
        throw new HttpError(
          400,
          "Include every appointed captain exactly once.",
        );
      await tx
        .update(captains)
        .set({ position: sql`-${captains.position} - 1` })
        .where(eq(captains.editionSlug, slug));
      for (const [position, userId] of command.userIds.entries())
        await tx
          .update(captains)
          .set({ position })
          .where(
            and(eq(captains.editionSlug, slug), eq(captains.userId, userId)),
          );
    } else if (command.action === "availability") {
      if (before.some((c) => c.userId === command.userId))
        throw new HttpError(
          409,
          "Revoke the captain appointment before changing availability.",
        );
      const rows = await tx
        .update(registrations)
        .set({
          draftUnavailableReason: command.available ? null : reason,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(registrations.editionSlug, slug),
            eq(registrations.userId, command.userId),
            eq(registrations.status, "accepted"),
          ),
        )
        .returning();
      if (!rows.length)
        throw new HttpError(409, "Accepted application not found.");
    } else if (command.action === "lock") {
      if (!before.length)
        throw new HttpError(
          409,
          "Appoint captains and review their order before locking.",
        );
      await tx
        .update(editionState)
        .set({ lockedAt: new Date() })
        .where(eq(editionState.slug, slug));
    } else if (command.action === "publish") {
      await tx
        .update(captains)
        .set({ published: command.published })
        .where(eq(captains.editionSlug, slug));
      await tx
        .update(editionState)
        .set({ poolPublished: command.poolPublished })
        .where(eq(editionState.slug, slug));
    }
    await tx
      .update(editionState)
      .set({ setupVersion: state.setupVersion + 1 })
      .where(eq(editionState.slug, slug));
    const after = await tx
      .select()
      .from(captains)
      .where(eq(captains.editionSlug, slug))
      .orderBy(captains.position);
    await tx.insert(editionEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      kind: `captain_${command.action}`,
      reason,
      detail: {
        before,
        after,
        command,
        fromVersion: expectedVersion,
        toVersion: expectedVersion + 1,
      },
    });
  });
  return captainSetup(actor, slug);
}
export async function publicCaptains(slug: string) {
  if (!getPublicEdition(slug) || !process.env.DATABASE_URL) return [];
  return db()
    .select({
      osuId: captains.userId,
      username: users.username,
      position: captains.position,
    })
    .from(captains)
    .innerJoin(users, eq(captains.userId, users.osuId))
    .where(and(eq(captains.editionSlug, slug), eq(captains.published, true)))
    .orderBy(captains.position);
}
export async function captainAppointment(userId: number, slug: string) {
  return (
    (
      await db()
        .select()
        .from(captains)
        .where(and(eq(captains.editionSlug, slug), eq(captains.userId, userId)))
    )[0] ?? null
  );
}
