import { and, count, desc, eq, ilike, or, inArray, ne, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  editionState,
  editionRevisions,
  registrationEvents,
  registrations,
  users,
} from "@/db/schema";
import type { User } from "./auth/sessions";
import { assertCapability, capabilityScope } from "./auth/staff";
import { HttpError } from "./http";
import { registrationOperation } from "./registrations";
const filterSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    edition: z
      .string()
      .regex(/^[a-z0-9-]*$/)
      .max(80)
      .default(""),
    status: z
      .enum(["active", "", "pending", "accepted", "rejected", "withdrawn"])
      .default("active"),
    page: z.coerce.number().int().min(1).max(10000).default(1),
  })
  .strict();
export function parseFilters(input: unknown) {
  const result = filterSchema.safeParse(input);
  if (!result.success) throw new HttpError(400, "Invalid search or filter.");
  return result.data;
}
export type StaffFilters = ReturnType<typeof parseFilters>;
function conditions(filters: StaffFilters) {
  return and(
    filters.edition
      ? eq(registrations.editionSlug, filters.edition)
      : undefined,
    filters.status === "active"
      ? ne(registrations.status, "withdrawn")
      : filters.status
        ? eq(registrations.status, filters.status)
        : undefined,
    filters.q
      ? or(
          ilike(users.username, `%${filters.q}%`),
          /^\d+$/.test(filters.q) && Number.isSafeInteger(Number(filters.q))
            ? eq(users.osuId, Number(filters.q))
            : undefined,
        )
      : undefined,
  );
}
const listFields = {
  id: registrations.id,
  userId: registrations.userId,
  username: users.username,
  editionSlug: registrations.editionSlug,
  status: registrations.status,
  createdAt: registrations.createdAt,
  updatedAt: registrations.updatedAt,
};
export async function listApplications(
  actor: User,
  input: unknown,
  exporting = false,
) {
  const scopes = await capabilityScope(actor, "manage_registrations");
  const filters = parseFilters(input);
  const where = and(
    conditions(filters),
    scopes ? inArray(registrations.editionSlug, scopes) : undefined,
  );
  const [rows, totals] = await Promise.all([
    db()
      .select(listFields)
      .from(registrations)
      .innerJoin(users, eq(registrations.userId, users.osuId))
      .where(where)
      .orderBy(desc(registrations.createdAt), registrations.id)
      .limit(exporting ? 10001 : 25)
      .offset(exporting ? 0 : (filters.page - 1) * 25),
    db()
      .select({ count: count() })
      .from(registrations)
      .innerJoin(users, eq(registrations.userId, users.osuId))
      .where(where),
  ]);
  if (exporting && rows.length > 10000)
    throw new HttpError(
      413,
      "Narrow the export filters to at most 10,000 applications.",
    );
  return { rows, total: totals[0].count, filters };
}
export async function applicationDetails(actor: User, id: string) {
  await capabilityScope(actor, "manage_registrations");
  if (!z.uuid().safeParse(id).success)
    throw new HttpError(404, "Application not found.");
  const [row] = await db()
    .select({
      registration: registrations,
      lastOperation: registrationOperation,
      username: users.username,
      acknowledgedConfiguration: editionRevisions.configuration,
    })
    .from(registrations)
    .innerJoin(users, eq(registrations.userId, users.osuId))
    .leftJoin(
      editionRevisions,
      and(
        eq(editionRevisions.editionSlug, registrations.editionSlug),
        eq(editionRevisions.version, registrations.configurationVersion),
      ),
    )
    .where(eq(registrations.id, id));
  if (!row) throw new HttpError(404, "Application not found.");
  await assertCapability(
    actor,
    "manage_registrations",
    row.registration.editionSlug,
  );
  return row;
}
export async function reviewApplication(
  actor: User,
  id: string,
  input: unknown,
) {
  await capabilityScope(actor, "manage_registrations");
  const result = z
    .object({
      status: z.enum(["accepted", "rejected"]),
      reason: z.string().trim().max(1000).default(""),
      expectedUpdatedAt: z.iso.datetime(),
      confirmed: z.literal(true),
    })
    .strict()
    .safeParse(input);
  if (!z.uuid().safeParse(id).success || !result.success)
    throw new HttpError(400, "Confirm a valid review decision.");
  if (result.data.status === "rejected" && !result.data.reason)
    throw new HttpError(400, "Give the player a reason for rejection.");
  return db().transaction(async (tx) => {
    const [record] = await tx
      .select()
      .from(registrations)
      .where(eq(registrations.id, id));
    if (!record) throw new HttpError(404, "Application not found.");
    await assertCapability(
      actor,
      "manage_registrations",
      record.editionSlug,
      tx,
    );
    const [edition] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, record.editionSlug))
      .for("update");
    const [current] = await tx
      .select()
      .from(registrations)
      .where(eq(registrations.id, id))
      .for("update");
    if (
      edition.registrationPausedAt ||
      current.status !== "pending" ||
      current.updatedAt.toISOString() !== result.data.expectedUpdatedAt
    )
      throw new HttpError(
        409,
        "This application changed or its edition is locked. Refresh before reviewing.",
      );
    const updatedAt = new Date(
      Math.max(Date.now(), current.updatedAt.getTime() + 1),
    );
    const [updated] = await tx
      .update(registrations)
      .set({
        status: result.data.status,
        statusReason: result.data.reason || null,
        updatedAt,
      })
      .where(eq(registrations.id, id))
      .returning();
    await tx.insert(registrationEvents).values({
      registrationId: id,
      actorId: actor.osuId,
      fromStatus: current.status,
      toStatus: result.data.status,
      reason: result.data.reason || null,
      createdAt: updatedAt,
    });
    return updated;
  });
}

/** Administrative withdrawal is a transition, never a row/account deletion.
 * The edition lock serializes this with review, captain changes and draft picks. */
export async function changeRegistrationParticipation(
  actor: User,
  slug: string,
  id: string,
  action: "remove" | "restore",
  input: unknown,
) {
  await assertCapability(actor, "manage_registrations", slug);
  const parsed = z
    .object({
      expectedUpdatedAt: z.iso.datetime(),
      confirmed: z.literal(true),
    })
    .strict()
    .safeParse(input);
  if (!z.uuid().safeParse(id).success || !parsed.success)
    throw new HttpError(400, "Confirm a valid registration change.");
  return db().transaction(async (tx) => {
    const [edition] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    await assertCapability(actor, "manage_registrations", slug, tx);
    const [target] = await tx
      .select({
        registration: registrations,
        lastOperation: registrationOperation,
      })
      .from(registrations)
      .where(and(eq(registrations.id, id), eq(registrations.editionSlug, slug)))
      .for("update");
    if (!edition || !target) throw new HttpError(404, "Application not found.");
    const current = target.registration;
    if (current.updatedAt.toISOString() !== parsed.data.expectedUpdatedAt)
      throw new HttpError(
        409,
        "This registration changed. Refresh before continuing.",
      );
    if (action === "remove" && current.status === "withdrawn")
      throw new HttpError(409, "This registration is already withdrawn.");
    if (
      action === "restore" &&
      (current.status !== "withdrawn" ||
        target.lastOperation !== "staff_remove")
    )
      throw new HttpError(
        409,
        "Only a registration removed by staff can be restored for review.",
      );
    if (action === "restore" && edition.configuration?.status === "completed")
      throw new HttpError(
        409,
        "Registration cannot be restored in a completed tournament.",
      );
    const dependencies = await tx.execute<{
      assigned: boolean;
      protectedPool: boolean;
    }>(sql`
      SELECT (
        EXISTS(SELECT 1 FROM captains WHERE edition_slug=${slug} AND user_id=${current.userId}) OR
        EXISTS(SELECT 1 FROM teams WHERE edition_slug=${slug} AND captain_id=${current.userId} AND archived_at IS NULL) OR
        EXISTS(SELECT 1 FROM memberships WHERE edition_slug=${slug} AND user_id=${current.userId} AND left_at IS NULL) OR
        EXISTS(SELECT 1 FROM draft_picks p JOIN draft_sessions s ON s.id=p.session_id
          WHERE s.edition_slug=${slug} AND p.voided_at IS NULL AND (p.player_id=${current.userId} OR p.captain_id=${current.userId})) OR
        EXISTS(SELECT 1 FROM teams t JOIN fixtures f ON (f.home_team_id=t.id OR f.away_team_id=t.id)
          WHERE t.edition_slug=${slug} AND (t.captain_id=${current.userId} OR
            EXISTS(SELECT 1 FROM memberships m WHERE m.team_id=t.id AND m.user_id=${current.userId})))
      ) AS "assigned", EXISTS(SELECT 1 FROM draft_sessions s WHERE s.edition_slug=${slug}
        AND s.pool @> ${JSON.stringify([current.userId])}::jsonb
      ) AS "protectedPool"`);
    if (dependencies.rows[0].assigned)
      throw new HttpError(
        409,
        "Resolve this player's captain, roster or competition references before removing registration. Use the captain, team or draft recovery tools.",
      );
    if (dependencies.rows[0].protectedPool)
      throw new HttpError(
        409,
        "This player belongs to a protected draft pool. Use the explicit draft recovery tools before removing registration.",
      );
    const updatedAt = new Date(
      Math.max(Date.now(), current.updatedAt.getTime() + 1),
    );
    const status = action === "remove" ? "withdrawn" : "pending";
    await tx
      .update(registrations)
      .set({
        status,
        updatedAt,
        ...(action === "restore" ? { statusReason: null } : {}),
      })
      .where(eq(registrations.id, id));
    await tx.insert(registrationEvents).values({
      registrationId: id,
      actorId: actor.osuId,
      operation: action === "remove" ? "staff_remove" : "staff_restore",
      fromStatus: current.status,
      toStatus: status,
      createdAt: updatedAt,
    });
    return { id, status, updatedAt };
  });
}
