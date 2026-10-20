import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { editionState, staffRoles, staffRoleEvents, users } from "@/db/schema";
import { assertCapability, capabilityScope, roles } from "./auth/staff";
import type { User } from "./auth/sessions";
import { getEditions } from "./content";
import { HttpError } from "./http";
const confirmation = {
  confirmed: z.literal(true),
};
const command = z.discriminatedUnion("action", [
  z
    .object({
      ...confirmation,
      action: z.literal("grant"),
      userId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
      role: z.enum(roles),
      editionSlug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(80)
        .nullable(),
    })
    .strict(),
  z
    .object({ ...confirmation, action: z.literal("revoke"), grantId: z.uuid() })
    .strict(),
]);
export async function listStaffRoles(actor: User) {
  const scopes = await capabilityScope(actor, "manage_staff");
  const where = scopes ? inArray(staffRoles.editionSlug, scopes) : undefined;
  const grants = await db()
    .select({ grant: staffRoles, username: users.username })
    .from(staffRoles)
    .innerJoin(users, eq(users.osuId, staffRoles.userId))
    .where(where)
    .orderBy(desc(staffRoles.grantedAt))
    .limit(500);
  const events = await db()
    .select()
    .from(staffRoleEvents)
    .where(scopes ? inArray(staffRoleEvents.editionSlug, scopes) : undefined)
    .orderBy(desc(staffRoleEvents.createdAt), desc(staffRoleEvents.id))
    .limit(100);
  return { grants, events, scopes };
}
export async function changeStaffRole(actor: User, input: unknown) {
  await capabilityScope(actor, "manage_staff");
  const parsed = command.safeParse(input);
  if (!parsed.success) throw new HttpError(400, "Confirm a valid role change.");
  const c = parsed.data;
  return db().transaction(async (tx) => {
    // Serialize grants/revocations so duplicate requests cannot create competing active grants.
    await tx.execute(sql`SELECT pg_advisory_xact_lock(17301)`);
    if (c.action === "grant") {
      await assertCapability(
        actor,
        "manage_staff",
        c.editionSlug ?? undefined,
        tx,
      );
      if (c.editionSlug && !getEditions().some((e) => e.slug === c.editionSlug))
        throw new HttpError(404, "Edition not found.");
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.osuId, c.userId));
      if (!user)
        throw new HttpError(
          400,
          "The verified osu! user must sign in before receiving a role.",
        );
      if (c.editionSlug)
        await tx
          .insert(editionState)
          .values({ slug: c.editionSlug })
          .onConflictDoNothing();
      const [existing] = await tx
        .select()
        .from(staffRoles)
        .where(
          and(
            eq(staffRoles.userId, c.userId),
            eq(staffRoles.role, c.role),
            c.editionSlug
              ? eq(staffRoles.editionSlug, c.editionSlug)
              : isNull(staffRoles.editionSlug),
            isNull(staffRoles.revokedAt),
          ),
        );
      if (existing)
        throw new HttpError(
          409,
          "This active role already exists. Refresh the role list.",
        );
      const [grant] = await tx
        .insert(staffRoles)
        .values({
          userId: c.userId,
          role: c.role,
          editionSlug: c.editionSlug,
          grantedBy: actor.osuId,
        })
        .returning();
      await tx.insert(staffRoleEvents).values({
        grantId: grant.id,
        actorId: actor.osuId,
        targetId: grant.userId,
        role: grant.role,
        editionSlug: grant.editionSlug,
        action: "grant",
        before: null,
        after: grant,
      });
      return grant;
    }
    const [grant] = await tx
      .select()
      .from(staffRoles)
      .where(eq(staffRoles.id, c.grantId))
      .for("update");
    if (!grant) throw new HttpError(404, "Role grant not found.");
    await assertCapability(
      actor,
      "manage_staff",
      grant.editionSlug ?? undefined,
      tx,
    );
    if (grant.revokedAt)
      throw new HttpError(
        409,
        "This role was already revoked. Refresh the role list.",
      );
    const [updated] = await tx
      .update(staffRoles)
      .set({ revokedAt: new Date() })
      .where(eq(staffRoles.id, grant.id))
      .returning();
    await tx.insert(staffRoleEvents).values({
      grantId: grant.id,
      actorId: actor.osuId,
      targetId: grant.userId,
      role: grant.role,
      editionSlug: grant.editionSlug,
      action: "revoke",
      before: grant,
      after: updated,
    });
    return updated;
  });
}
