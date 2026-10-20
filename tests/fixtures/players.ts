import { assertTestDatabase } from "../database";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../src/db";
import {
  captains,
  editionState,
  memberships,
  registrations,
  teams,
  users,
} from "../../src/db/schema";
// Isolated test fixture only; never imported by application code.
export async function seedPublicDirectory(base: number) {
  const url = process.env.TEST_DATABASE_URL;
  assertTestDatabase(url);
  process.env.DATABASE_URL = url;
  const ids = [base, base + 1, base + 2, base + 3];
  await db().delete(memberships).where(inArray(memberships.userId, ids));
  await db().delete(teams).where(inArray(teams.captainId, ids));
  await db().delete(captains).where(inArray(captains.userId, ids));
  await db().delete(registrations).where(inArray(registrations.userId, ids));
  await db().delete(users).where(inArray(users.osuId, ids));
  await db()
    .insert(users)
    .values(
      ids.map((osuId, i) => ({
        osuId,
        username: `Synthetic Directory ${base} ${["Captain", "Member", "Private Applicant", "Unpublished Captain"][i]}`,
      })),
    );
  await db()
    .insert(editionState)
    .values([{ slug: "test-cup" }, { slug: "private-test-cup" }])
    .onConflictDoNothing();
  await db()
    .insert(registrations)
    .values(
      ids.map((userId) => ({
        userId,
        editionSlug: "test-cup",
        status: "accepted" as const,
        rulesVersion: "test-v1",
        answers: { private: "SYNTHETIC_PRIVATE_CONTACT" },
        statusReason: "SYNTHETIC_INTERNAL_REASON",
      })),
    );
  await db()
    .insert(captains)
    .values([
      {
        editionSlug: "test-cup",
        userId: base,
        position: base,
        published: true,
      },
      {
        editionSlug: "test-cup",
        userId: base + 3,
        position: base + 1,
        published: false,
      },
    ]);
  const [team] = await db()
    .insert(teams)
    .values({
      editionSlug: "test-cup",
      captainId: base,
      name: `Synthetic Directory Team ${base}`,
      identityPublished: true,
      rosterPublished: true,
      finalizedAt: new Date(),
    })
    .returning();
  await db()
    .insert(memberships)
    .values([
      {
        editionSlug: "test-cup",
        teamId: team.id,
        userId: base,
        origin: "captain",
      },
      {
        editionSlug: "test-cup",
        teamId: team.id,
        userId: base + 1,
        origin: "draft",
      },
    ]);
  const [privateRegistration] = await db()
    .select()
    .from(registrations)
    .where(
      and(
        eq(registrations.userId, base + 2),
        eq(registrations.editionSlug, "test-cup"),
      ),
    );
  return {
    captainId: base,
    memberId: base + 1,
    privateId: base + 2,
    unpublishedCaptainId: base + 3,
    privateRegistrationId: privateRegistration.id,
    teamId: team.id,
  };
}
