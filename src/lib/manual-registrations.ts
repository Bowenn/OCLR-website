import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  editionState,
  registrations,
  registrationEvents,
  users,
} from "@/db/schema";
import { assertCapability } from "./auth/staff";
import type { User } from "./auth/sessions";
import { privacyReady } from "./auth/config";
import { competitionStructureProtected, storedEdition } from "./tournaments";
import { enrollmentState } from "./editions";
import { getOsuUserProfile } from "./osu-profiles";
import { parseOsuProfile } from "./osu-profile-model";
import { verifyEligibility } from "./eligibility";
import { HttpError } from "./http";
const lookupInput = z
  .object({ input: z.string().trim().min(1).max(300) })
  .strict();
const enrollmentInput = lookupInput
  .extend({
    expectedRevision: z.number().int().nonnegative(),
    status: z.enum(["pending", "accepted"]),
    confirmed: z.literal(true),
    publicationAcknowledged: z.boolean().default(false),
    overrideWindow: z.boolean().default(false),
    overrideEligibility: z.boolean().default(false),
    exceptionReason: z.string().trim().max(1000).default(""),
  })
  .strict();
async function verifiedIdentity(input: string) {
  const identity = parseOsuProfile(input);
  const snapshot = await getOsuUserProfile(identity.osuId, identity.mode);
  if (snapshot.stale || snapshot.notice)
    throw new HttpError(
      503,
      "A current verified osu! profile is required. Retry when the provider is available.",
    );
  return snapshot.profile;
}
async function context(
  actor: User,
  slug: string,
  reader: Pick<ReturnType<typeof db>, "select"> = db(),
  lock = false,
) {
  await assertCapability(actor, "manage_registrations", slug, reader);
  const query = reader
    .select()
    .from(editionState)
    .where(eq(editionState.slug, slug));
  const [state] = await (lock ? query.for("update") : query);
  const edition = state && storedEdition(state)?.edition;
  if (!edition) throw new HttpError(404, "Tournament not found.");
  if (
    edition.status === "completed" ||
    (await competitionStructureProtected(slug, Boolean(state.lockedAt), reader))
  )
    throw new HttpError(
      409,
      "Manual enrollment is unavailable for a completed, locked or frozen tournament.",
    );
  if (!privacyReady())
    throw new HttpError(503, "Registration is awaiting privacy configuration.");
  return {
    edition,
    revision: state.configurationVersion,
    outsideWindow: enrollmentState(edition) !== "open",
  };
}
export async function previewManualRegistration(
  actor: User,
  slug: string,
  input: unknown,
) {
  const parsed = lookupInput.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      400,
      "Enter a numeric osu! ID or canonical HTTPS osu! profile URL.",
    );
  await context(actor, slug);
  const profile = await verifiedIdentity(parsed.data.input);
  // Permission and edition state are checked again after provider I/O.
  const current = await context(actor, slug);
  return {
    profile,
    verification: await verifyEligibility(
      profile.osuId,
      current.edition,
      current.revision,
    ),
    edition: {
      slug,
      name: current.edition.name,
      revision: current.revision,
      outsideWindow: current.outsideWindow,
    },
  };
}
export async function addManualRegistration(
  actor: User,
  slug: string,
  input: unknown,
) {
  await assertCapability(actor, "manage_registrations", slug);
  const parsed = enrollmentInput.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Confirm a valid player and registration status.");
  const command = parsed.data;
  if (command.status === "accepted" && !command.publicationAcknowledged)
    throw new HttpError(
      400,
      "Confirm publication of the accepted player's basic identity.",
    );
  const initial = await context(actor, slug);
  const profile = await verifiedIdentity(command.input);
  const verification = await verifyEligibility(
    profile.osuId,
    initial.edition,
    initial.revision,
  );
  if (
    verification &&
    verification.status !== "pass" &&
    !command.overrideEligibility
  )
    throw new HttpError(
      409,
      "Explicitly confirm the staff eligibility override before adding this player.",
    );
  return db().transaction(async (tx) => {
    const current = await context(actor, slug, tx, true);
    if (
      current.revision !== command.expectedRevision ||
      current.revision !== initial.revision
    )
      throw new HttpError(
        409,
        "The tournament configuration changed. Verify the player again before adding.",
      );
    if (
      current.outsideWindow &&
      (!command.overrideWindow || !command.exceptionReason)
    )
      throw new HttpError(
        409,
        "Confirm the registration-window exception and provide its explanation.",
      );
    // Serialize conflicting identity inserts on the stable user ID, then let the
    // edition/user constraint reject every duplicate status, including withdrawn.
    await tx
      .insert(users)
      .values({ osuId: profile.osuId, username: profile.username })
      .onConflictDoNothing();
    const [registration] = await tx
      .insert(registrations)
      .values({
        editionSlug: slug,
        userId: profile.osuId,
        status: command.status,
        source: "staff",
        configurationVersion: current.revision,
        rulesVersion: null,
        eligibilityAcknowledged: null,
        eligibilityVerification: verification
          ? {
              ...verification,
              status:
                verification.status === "pass" ? "pass" : "staff_override",
            }
          : null,
        answers: {},
      })
      .onConflictDoNothing({
        target: [registrations.editionSlug, registrations.userId],
      })
      .returning();
    if (!registration)
      throw new HttpError(
        409,
        "This player already has a registration for this tournament. Review the existing entry.",
      );
    await tx.insert(registrationEvents).values({
      registrationId: registration.id,
      actorId: actor.osuId,
      toStatus: command.status,
      reason: current.outsideWindow ? command.exceptionReason : null,
    });
    return registration;
  });
}
