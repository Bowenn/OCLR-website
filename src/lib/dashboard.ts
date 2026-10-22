import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { editionState, editionRevisions, registrations } from "@/db/schema";
import { getPublicEditions } from "./content";
import { captainAppointment } from "./captains";
import { canWithdraw } from "./registrations";
export async function playerApplications(userId: number) {
  const rows = await db()
    .select({
      registration: registrations,
      registrationPausedAt: editionState.registrationPausedAt,
      assigned: sql<boolean>`EXISTS(SELECT 1 FROM memberships m WHERE m.edition_slug=${registrations.editionSlug} AND m.user_id=${registrations.userId} AND m.left_at IS NULL)`,
      acknowledgedConfiguration: editionRevisions.configuration,
    })
    .from(registrations)
    .innerJoin(editionState, eq(registrations.editionSlug, editionState.slug))
    .leftJoin(
      editionRevisions,
      and(
        eq(editionRevisions.editionSlug, registrations.editionSlug),
        eq(editionRevisions.version, registrations.configurationVersion),
      ),
    )
    .where(eq(registrations.userId, userId))
    .orderBy(registrations.createdAt);
  const editions = await getPublicEditions();
  return Promise.all(
    rows.map(
      async ({
        registration,
        registrationPausedAt,
        assigned,
        acknowledgedConfiguration,
      }) => {
        const edition = editions.find(
          (e) => e.slug === registration.editionSlug,
        );
        const appointment = await captainAppointment(
          userId,
          registration.editionSlug,
        );
        return {
          captainAssigned: Boolean(appointment),
          registration,
          acknowledgedConfiguration,
          edition,
          withdrawable: canWithdraw(
            edition,
            registration,
            Boolean(registrationPausedAt) || Boolean(appointment) || assigned,
          ),
        };
      },
    ),
  );
}
export const statusCopy = {
  pending: "Your application is saved and awaiting staff review.",
  accepted:
    "Your application is accepted. Follow published captain and draft announcements; acceptance does not assign a team.",
  rejected:
    "Your application was not accepted. See the staff explanation below when provided.",
  withdrawn:
    "You withdrew this application. It will not enter the eligible player pool.",
};
