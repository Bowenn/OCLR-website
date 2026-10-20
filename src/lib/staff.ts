import { and, count, desc, eq, ilike, or, inArray } from "drizzle-orm";
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
const filterSchema = z
  .object({
    q: z.string().trim().max(100).default(""),
    edition: z
      .string()
      .regex(/^[a-z0-9-]*$/)
      .max(80)
      .default(""),
    status: z
      .enum(["", "pending", "accepted", "rejected", "withdrawn"])
      .default(""),
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
    filters.status ? eq(registrations.status, filters.status) : undefined,
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
  const events = await db()
    .select()
    .from(registrationEvents)
    .where(eq(registrationEvents.registrationId, id))
    .orderBy(registrationEvents.createdAt);
  return { ...row, events };
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
      edition.lockedAt ||
      current.status !== "pending" ||
      current.updatedAt.toISOString() !== result.data.expectedUpdatedAt
    )
      throw new HttpError(
        409,
        "This application changed or its edition is locked. Refresh before reviewing.",
      );
    const [updated] = await tx
      .update(registrations)
      .set({
        status: result.data.status,
        statusReason: result.data.reason || null,
        updatedAt: new Date(),
      })
      .where(eq(registrations.id, id))
      .returning();
    await tx.insert(registrationEvents).values({
      registrationId: id,
      actorId: actor.osuId,
      fromStatus: current.status,
      toStatus: result.data.status,
      reason: result.data.reason || null,
    });
    return updated;
  });
}
