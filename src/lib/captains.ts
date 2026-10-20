import { and, eq, sql, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  captains,
  editionEvents,
  editionState,
  registrations,
  users,
  teams,
  memberships,
} from "@/db/schema";
import { getEdition, getPublicEdition } from "./content";
import { assertCapability } from "./auth/staff";
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
      unavailableExplanation: z.string().trim().min(1).max(1000).optional(),
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
    confirmed: z.literal(true),
  })
  .strict();
export async function captainSetup(actor: User, slug: string) {
  await assertCapability(actor, "manage_captains", slug);
  if (!(await getEdition(slug))) throw new HttpError(404, "Edition not found.");
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
      const roster = await tx
        .select({ userId: memberships.userId })
        .from(memberships)
        .where(
          and(eq(memberships.editionSlug, slug), isNull(memberships.leftAt)),
        );
      const assignedTeams = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)));
      return {
        version: state?.setupVersion ?? 0,
        locked: Boolean(state?.lockedAt),
        poolPublished: state?.poolPublished ?? false,
        captains: appointed.map((c) => ({
          ...c,
          teamId:
            assignedTeams.find((t) => t.captainId === c.userId)?.id ?? null,
          teamName:
            assignedTeams.find((t) => t.captainId === c.userId)?.name ?? null,
        })),
        candidates,
        pool: candidates.filter(
          (c) =>
            !c.unavailableReason &&
            !appointed.some((a) => a.userId === c.userId) &&
            !roster.some((m) => m.userId === c.userId),
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
  await assertCapability(actor, "manage_captains", slug);
  if (!(await getEdition(slug))) throw new HttpError(404, "Edition not found.");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Confirm a valid captain setup action.");
  const { command, expectedVersion } = parsed.data;
  if (
    command.action === "availability" &&
    !command.available &&
    !command.unavailableExplanation
  )
    throw new HttpError(
      400,
      "Explain why this player is unavailable for the draft.",
    );
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
    let rosterChange: Record<string, unknown> | undefined;
    let availabilityChange: Record<string, unknown> | undefined;
    if (command.action === "revoke" || command.action === "replace") {
      const previousId =
        command.action === "revoke" ? command.userId : command.previousUserId;
      const [assigned] = await tx
        .select()
        .from(teams)
        .where(
          and(
            eq(teams.editionSlug, slug),
            eq(teams.captainId, previousId),
            isNull(teams.archivedAt),
          ),
        );
      if (assigned) {
        const members = await tx
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.teamId, assigned.id),
              isNull(memberships.leftAt),
            ),
          );
        if (
          assigned.finalizedAt ||
          members.some((m) => m.userId !== previousId)
        )
          throw new HttpError(
            409,
            "Assigned rosters require supervised draft correction.",
          );
        const changedMembers = await tx
          .update(memberships)
          .set({ leftAt: new Date() })
          .where(
            and(
              eq(memberships.teamId, assigned.id),
              isNull(memberships.leftAt),
            ),
          )
          .returning();
        const [changedTeam] = await tx
          .update(teams)
          .set({
            archivedAt: new Date(),
            identityPublished: false,
            rosterPublished: false,
          })
          .where(eq(teams.id, assigned.id))
          .returning();
        rosterChange = {
          before: { team: assigned, members },
          after: { team: changedTeam, members: changedMembers },
        };
      }
    }
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
      const [prior] = await tx
        .select({
          userId: registrations.userId,
          unavailableExplanation: registrations.draftUnavailableReason,
        })
        .from(registrations)
        .where(
          and(
            eq(registrations.editionSlug, slug),
            eq(registrations.userId, command.userId),
          ),
        );
      const rows = await tx
        .update(registrations)
        .set({
          draftUnavailableReason: command.available
            ? null
            : command.unavailableExplanation!,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(registrations.editionSlug, slug),
            eq(registrations.userId, command.userId),
            eq(registrations.status, "accepted"),
          ),
        )
        .returning({
          userId: registrations.userId,
          unavailableExplanation: registrations.draftUnavailableReason,
        });
      if (!rows.length)
        throw new HttpError(409, "Accepted application not found.");
      availabilityChange = { before: prior, after: rows[0] };
    } else if (command.action === "lock") {
      const configured = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)));
      if (before.some((c) => !configured.some((t) => t.captainId === c.userId)))
        throw new HttpError(
          409,
          "Configure one team for every captain before locking.",
        );
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
    const [setupAfter] = await tx
      .update(editionState)
      .set({ setupVersion: state.setupVersion + 1 })
      .where(eq(editionState.slug, slug))
      .returning();
    const after = await tx
      .select()
      .from(captains)
      .where(eq(captains.editionSlug, slug))
      .orderBy(captains.position);
    await tx.insert(editionEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      kind: `captain_${command.action}`,
      detail: {
        entity: { type: "captain_setup", id: slug },
        before,
        after,
        setupBefore: state,
        setupAfter,
        ...(rosterChange ? { rosterChange } : {}),
        ...(availabilityChange ? { availabilityChange } : {}),
        command,
        fromVersion: expectedVersion,
        toVersion: expectedVersion + 1,
      },
    });
  });
  return captainSetup(actor, slug);
}
export async function publicCaptains(slug: string) {
  if (!(await getPublicEdition(slug)) || !process.env.DATABASE_URL) return [];
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
