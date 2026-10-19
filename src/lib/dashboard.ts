import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { editionState, registrations } from "@/db/schema";
import { getPublicEdition } from "./content";
import { captainAppointment } from "./captains";
import { canWithdraw } from "./registrations";
export async function playerApplications(userId: number) {
  const rows = await db()
    .select({ registration: registrations, lockedAt: editionState.lockedAt })
    .from(registrations)
    .innerJoin(editionState, eq(registrations.editionSlug, editionState.slug))
    .where(and(eq(registrations.userId, userId)))
    .orderBy(registrations.createdAt);
  return Promise.all(
    rows.map(async ({ registration, lockedAt }) => {
      const edition = getPublicEdition(registration.editionSlug);
      return {
        registration,
        edition,
        withdrawable: canWithdraw(
          edition,
          registration,
          Boolean(lockedAt) ||
            Boolean(await captainAppointment(userId, registration.editionSlug)),
        ),
      };
    }),
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
