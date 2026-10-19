import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  editionState,
  registrationEvents,
  registrations,
  captains,
  memberships,
} from "@/db/schema";
import { getPublicEdition } from "./content";
import { enrollmentState, type Edition } from "./editions";
import type { User } from "./auth/sessions";
import { privacyReady } from "./auth/config";
import { HttpError } from "./http";
const applicationInput = z
  .object({
    rulesAcknowledged: z.literal(true),
    eligibilityAcknowledged: z.literal(true),
    rulesVersion: z.string().min(1).max(80),
    answers: z.record(z.string(), z.string()).default({}),
  })
  .strict();
export function validateApplication(edition: Edition, input: unknown) {
  const result = applicationInput.safeParse(input);
  if (!result.success)
    throw new HttpError(
      400,
      "Acknowledge the rules and eligibility requirements, and check your answers.",
    );
  if (result.data.rulesVersion !== edition.rules?.version)
    throw new HttpError(
      409,
      "The rules have changed. Refresh and read them before applying.",
    );
  const questions = edition.registration?.questions ?? [];
  if (
    Object.keys(result.data.answers).some(
      (id) => !questions.some((q) => q.id === id),
    )
  )
    throw new HttpError(400, "The application contains an unknown question.");
  const answers: Record<string, string> = {};
  for (const question of questions) {
    const answer = (result.data.answers[question.id] ?? "").trim();
    if ((question.required && !answer) || answer.length > question.maxLength)
      throw new HttpError(400, `Check your answer to “${question.label}”.`);
    answers[question.id] = answer;
  }
  return { answers, rulesVersion: result.data.rulesVersion };
}
export async function submitRegistration(
  user: User,
  slug: string,
  input: unknown,
) {
  const edition = getPublicEdition(slug);
  if (!edition) throw new HttpError(404, "Tournament not found.");
  if (!privacyReady())
    throw new HttpError(503, "Registration is awaiting privacy configuration.");
  const values = validateApplication(edition, input);
  return db().transaction(async (tx) => {
    await tx.insert(editionState).values({ slug }).onConflictDoNothing();
    const [state] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    if (state.lockedAt || enrollmentState(edition) !== "open")
      throw new HttpError(409, "Registration is not open.");
    const [registration] = await tx
      .insert(registrations)
      .values({ editionSlug: slug, userId: user.osuId, ...values })
      .onConflictDoNothing({
        target: [registrations.editionSlug, registrations.userId],
      })
      .returning();
    if (!registration)
      throw new HttpError(
        409,
        "You already have an application for this edition. View it in your dashboard.",
      );
    await tx.insert(registrationEvents).values({
      registrationId: registration.id,
      actorId: user.osuId,
      toStatus: "pending",
    });
    return registration;
  });
}
export function canWithdraw(
  edition: Edition | undefined,
  registration: { status: string },
  locked: boolean,
  now = new Date(),
) {
  return Boolean(
    edition?.published &&
    !locked &&
    ["pending", "accepted"].includes(registration.status) &&
    edition.registration?.withdrawUntil &&
    now.getTime() < Date.parse(edition.registration.withdrawUntil),
  );
}
export async function withdrawRegistration(
  user: User,
  id: string,
  confirmed: unknown,
) {
  if (
    !z
      .object({ confirmed: z.literal(true) })
      .strict()
      .safeParse(confirmed).success ||
    !z.uuid().safeParse(id).success
  )
    throw new HttpError(400, "Confirm withdrawal before continuing.");
  return db().transaction(async (tx) => {
    const [own] = await tx
      .select()
      .from(registrations)
      .where(
        and(eq(registrations.id, id), eq(registrations.userId, user.osuId)),
      );
    if (!own) throw new HttpError(404, "Application not found.");
    const [state] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, own.editionSlug))
      .for("update");
    const [current] = await tx
      .select()
      .from(registrations)
      .where(eq(registrations.id, id))
      .for("update");
    const edition = getPublicEdition(own.editionSlug);
    const [captain] = await tx
      .select()
      .from(captains)
      .where(
        and(
          eq(captains.editionSlug, own.editionSlug),
          eq(captains.userId, user.osuId),
        ),
      );
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.editionSlug, own.editionSlug),
          eq(memberships.userId, user.osuId),
          isNull(memberships.leftAt),
        ),
      );
    if (membership)
      throw new HttpError(409, "Roster withdrawal requires staff review.");
    if (captain)
      throw new HttpError(409, "Captain withdrawal requires staff review.");
    if (!canWithdraw(edition, current, Boolean(state.lockedAt)))
      throw new HttpError(
        409,
        "Withdrawal is not available. Contact tournament staff for review.",
      );
    const [updated] = await tx
      .update(registrations)
      .set({ status: "withdrawn", statusReason: null, updatedAt: new Date() })
      .where(eq(registrations.id, id))
      .returning();
    await tx.insert(registrationEvents).values({
      registrationId: id,
      actorId: user.osuId,
      fromStatus: current.status,
      toStatus: "withdrawn",
    });
    return updated;
  });
}
export async function ownRegistrations(userId: number) {
  return db()
    .select({
      id: registrations.id,
      userId: registrations.userId,
      editionSlug: registrations.editionSlug,
      status: registrations.status,
      rulesVersion: registrations.rulesVersion,
      answers: registrations.answers,
      statusReason: registrations.statusReason,
      createdAt: registrations.createdAt,
      updatedAt: registrations.updatedAt,
    })
    .from(registrations)
    .where(eq(registrations.userId, userId))
    .orderBy(registrations.createdAt);
}
