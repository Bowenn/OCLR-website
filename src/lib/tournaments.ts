import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { editionState } from "@/db/schema";
import { editionSchema } from "./editions";
import { z } from "zod";
import {
  editionEvents,
  editionRevisions,
  registrations,
  draftSessions,
  teams,
} from "@/db/schema";
import { assertCapability, staffAccess, permits } from "./auth/staff";
import type { User } from "./auth/sessions";
import { privacyReady } from "./auth/config";
import { HttpError } from "./http";
import {
  enrollmentState,
  registrationBlockers,
  type Edition,
} from "./editions";
import { tournamentNavigation } from "./admin-navigation";
type Reader = Pick<ReturnType<typeof db>, "select">;
export function storedEdition(row: typeof editionState.$inferSelect) {
  if (!row.configuration) return undefined;
  return {
    edition: editionSchema.parse({ ...row.configuration, slug: row.slug }),
    revision: row.configurationVersion,
    createdAt: row.createdAt,
    updatedAt: row.configurationUpdatedAt,
    locked: Boolean(row.lockedAt),
  };
}
export async function readTournament(
  slug: string,
  reader: Reader = db(),
  publicOnly = false,
) {
  const [row] = await reader
    .select()
    .from(editionState)
    .where(
      and(
        eq(editionState.slug, slug),
        isNotNull(editionState.configuration),
        publicOnly
          ? sql`${editionState.configuration}->>'published' = 'true'`
          : undefined,
      ),
    );
  return row ? storedEdition(row) : undefined;
}
export async function readTournaments(publicOnly = false) {
  if (!process.env.DATABASE_URL) return [];
  const rows = await db()
    .select()
    .from(editionState)
    .where(
      and(
        isNotNull(editionState.configuration),
        publicOnly
          ? sql`${editionState.configuration}->>'published' = 'true'`
          : undefined,
      ),
    )
    .orderBy(desc(editionState.configurationUpdatedAt), editionState.slug);
  return rows.map((row) => storedEdition(row)!);
}

const shape = editionSchema.shape;
const identity = {
  name: shape.name,
  season: shape.season,
  summary: shape.summary,
  timeZone: shape.timeZone,
  branding: shape.branding,
};
const version = {
  expectedRevision: z.number().int().nonnegative(),
  confirmed: z.literal(true),
};
const policy = {
  existingApplicationsPolicy: z.literal("retain_existing").optional(),
};
const createSchema = z
  .object({
    slug: shape.slug.refine((s) => s !== "new", "This slug is reserved"),
    ...identity,
    confirmed: z.literal(true),
  })
  .strict();
const commandSchema = z.discriminatedUnion("action", [
  z
    .object({
      ...version,
      action: z.literal("general"),
      ...identity,
      status: shape.status,
    })
    .strict(),
  z
    .object({
      ...version,
      ...policy,
      action: z.literal("rules"),
      rules: shape.rules,
      eligibility: shape.eligibility,
    })
    .strict(),
  z
    .object({
      ...version,
      ...policy,
      action: z.literal("registration"),
      registration: shape.registration,
    })
    .strict(),
  z
    .object({
      ...version,
      action: z.literal("schedule"),
      schedule: shape.schedule,
    })
    .strict(),
  z
    .object({
      ...version,
      action: z.literal("publication"),
      published: z.boolean(),
      contentApproved: z.literal(true),
    })
    .strict(),
]);
function invalid(parsed: { success: boolean; error?: z.ZodError }) {
  if (!parsed.success)
    throw new HttpError(
      400,
      parsed.error?.issues[0]
        ? `${parsed.error.issues[0].path.join(".")}: ${parsed.error.issues[0].message}`
        : "Check the tournament settings.",
    );
}
export function tournamentReadiness(e: Edition, locked = false) {
  return [
    { label: "Approved rules", ready: Boolean(e.rules) },
    { label: "Eligibility disclosure", ready: Boolean(e.eligibility) },
    { label: "Registration dates", ready: Boolean(e.registration) },
    { label: "Privacy configuration", ready: privacyReady() },
    {
      label: "Registration unlocked",
      ready: !locked && e.status !== "completed",
    },
  ];
}
export function tournamentLinks(
  grants: Awaited<ReturnType<typeof staffAccess>>,
  slug: string,
) {
  const can = (cap: Parameters<typeof permits>[1]) =>
    permits(grants, cap, slug);
  return tournamentNavigation.flatMap((group) =>
    group.items
      .filter((item) => !item.capabilities || item.capabilities.some(can))
      .map((item) => ({
        href: `/admin/tournaments/${slug}${item.path ? `/${item.path}` : ""}`,
        label: item.label,
        group: group.label,
        exact: item.path === "",
      })),
  );
}
export async function tournamentList(actor: User) {
  const grants = await staffAccess(actor);
  if (!grants.length) throw new HttpError(403, "Staff access is required.");
  const rows = await readTournaments();
  return {
    canCreate: permits(grants, "configure_tournament"),
    rows: rows
      .filter((row) =>
        grants.some(
          (g) => !g.editionSlug || g.editionSlug === row.edition.slug,
        ),
      )
      .map((row) => ({
        slug: row.edition.slug,
        name: row.edition.name,
        season: row.edition.season,
        status: row.edition.status,
        published: row.edition.published,
        registrationState: !row.edition.registration
          ? "not_configured"
          : row.locked || row.edition.status === "completed"
            ? "closed"
            : row.edition.registration.enabled === false
              ? "paused"
              : enrollmentState(row.edition) === "open" && !privacyReady()
                ? "unavailable"
                : enrollmentState(row.edition),
        registration: row.edition.registration
          ? {
              opensAt: row.edition.registration.opensAt,
              closesAt: row.edition.registration.closesAt,
            }
          : null,
        timeZone: row.edition.timeZone,
        updatedAt: row.updatedAt,
        links: tournamentLinks(grants, row.edition.slug),
      })),
  };
}
async function configurationFrozen(
  slug: string,
  locked: boolean,
  reader: Reader,
) {
  if (locked) return true;
  const [session] = await reader
    .select({ state: draftSessions.state })
    .from(draftSessions)
    .where(eq(draftSessions.editionSlug, slug));
  const [finalTeam] = await reader
    .select({ id: teams.id })
    .from(teams)
    .where(and(eq(teams.editionSlug, slug), isNotNull(teams.finalizedAt)))
    .limit(1);
  return (
    Boolean(finalTeam) ||
    Boolean(session && !["setup", "aborted"].includes(session.state))
  );
}
export async function tournamentForAdmin(actor: User, slug: string) {
  await assertCapability(actor, "configure_tournament", slug);
  const row = await readTournament(slug);
  if (!row) throw new HttpError(404, "Tournament not found.");
  const events = await db()
    .select()
    .from(editionEvents)
    .where(
      and(
        eq(editionEvents.editionSlug, slug),
        sql`${editionEvents.kind} LIKE 'tournament_%'`,
      ),
    )
    .orderBy(desc(editionEvents.createdAt))
    .limit(50);
  const [applications] = await db()
    .select({ count: sql<number>`count(*)::int` })
    .from(registrations)
    .where(eq(registrations.editionSlug, slug));
  const frozen = await configurationFrozen(slug, row.locked, db());
  return {
    ...row,
    frozen,
    events,
    applications: applications.count,
    readiness: tournamentReadiness(row.edition, frozen),
    links: tournamentLinks(await staffAccess(actor), slug),
  };
}
export async function createTournament(actor: User, input: unknown) {
  await assertCapability(actor, "configure_tournament");
  const parsed = createSchema.safeParse(input);
  invalid(parsed);
  if (!parsed.success) throw new HttpError(400, "Invalid tournament.");
  const { slug, confirmed: _confirmed, ...fields } = parsed.data;
  void _confirmed;
  const e = editionSchema.parse({
    slug,
    ...fields,
    published: false,
    status: "upcoming",
    rules: null,
    eligibility: null,
    registration: null,
    schedule: [],
  });
  const { slug: _slug, ...configuration } = e;
  void _slug;
  try {
    await db().transaction(async (tx) => {
      await assertCapability(actor, "configure_tournament", undefined, tx);
      await tx.insert(editionState).values({ slug, configuration });
      await tx
        .insert(editionRevisions)
        .values({ editionSlug: slug, version: 0, configuration });
      await tx.insert(editionEvents).values({
        editionSlug: slug,
        actorId: actor.osuId,
        kind: "tournament_create",
        detail: {
          entity: { type: "tournament", id: slug },
          before: null,
          after: { configuration, revision: 0 },
        },
      });
    });
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "23505")
      throw new HttpError(409, "That tournament slug already exists.");
    throw error;
  }
  return tournamentForAdmin(actor, slug);
}
export async function tournamentCommand(
  actor: User,
  slug: string,
  input: unknown,
) {
  await assertCapability(actor, "configure_tournament", slug);
  const parsed = commandSchema.safeParse(input);
  invalid(parsed);
  if (!parsed.success) throw new HttpError(400, "Invalid settings.");
  const c = parsed.data;
  await db().transaction(async (tx) => {
    const [state] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    const current = state && storedEdition(state);
    if (!current) throw new HttpError(404, "Tournament not found.");
    await assertCapability(actor, "configure_tournament", slug, tx);
    if (current.revision !== c.expectedRevision)
      throw new HttpError(
        409,
        "Tournament settings changed. Refresh before saving your changes.",
      );
    const frozen = await configurationFrozen(slug, current.locked, tx);
    if (frozen && ["rules", "registration", "schedule"].includes(c.action))
      throw new HttpError(
        409,
        "Rules, registration and milestones are frozen after setup locks or drafting begins. Competition fixtures retain their separate workflow.",
      );
    const e = current.edition;
    let next: Edition = e;
    const applications = await tx
      .select({ rulesVersion: registrations.rulesVersion })
      .from(registrations)
      .where(eq(registrations.editionSlug, slug));
    const revisions = await tx
      .select()
      .from(editionRevisions)
      .where(eq(editionRevisions.editionSlug, slug));
    if (c.action === "general")
      next = {
        ...e,
        name: c.name,
        season: c.season,
        summary: c.summary,
        status: c.status,
        timeZone: c.timeZone,
        branding: c.branding,
        registration:
          e.registration && c.status === "completed"
            ? { ...e.registration, enabled: false }
            : e.registration,
      };
    if (c.action === "rules") {
      const changed =
        JSON.stringify({ rules: e.rules, eligibility: e.eligibility }) !==
        JSON.stringify({ rules: c.rules, eligibility: c.eligibility });
      if (changed && e.registration?.enabled)
        throw new HttpError(
          409,
          "Pause registration before changing approved rules or eligibility.",
        );
      if (
        changed &&
        e.rules &&
        (!c.rules ||
          c.rules.version === e.rules.version ||
          revisions.some(
            (r) => r.configuration.rules?.version === c.rules?.version,
          ))
      )
        throw new HttpError(
          409,
          "Use a new, unused rules version; acknowledged rules cannot be rewritten.",
        );
      if (
        changed &&
        applications.length &&
        c.existingApplicationsPolicy !== "retain_existing"
      )
        throw new HttpError(
          400,
          "Confirm organizer approval to retain existing applications under their saved rules.",
        );
      next = { ...e, rules: c.rules, eligibility: c.eligibility };
    }
    if (c.action === "registration") {
      const changedQuestions =
        JSON.stringify(e.registration?.questions ?? []) !==
        JSON.stringify(c.registration?.questions ?? []);
      if (changedQuestions && applications.length) {
        if (
          e.registration?.enabled ||
          applications.some((a) => a.rulesVersion === e.rules?.version)
        )
          throw new HttpError(
            409,
            "Pause registration and save a new rules version before changing questions with existing applications.",
          );
        if (c.existingApplicationsPolicy !== "retain_existing")
          throw new HttpError(
            400,
            "Confirm organizer approval to retain applications with their saved questions.",
          );
      }
      const previousIds = new Set(
        e.registration?.questions.map((q) => q.id) ?? [],
      );
      const retired = new Set(
        revisions
          .flatMap(
            (r) =>
              r.configuration.registration?.questions.map((q) => q.id) ?? [],
          )
          .filter((id) => !previousIds.has(id)),
      );
      if (c.registration?.questions.some((q) => retired.has(q.id)))
        throw new HttpError(
          409,
          "A retired question ID cannot be reused. Choose a new stable ID.",
        );
      if (c.registration?.enabled) {
        const blockers = registrationBlockers(e, privacyReady());
        if (blockers.length) throw new HttpError(409, blockers.join(" "));
      }
      next = { ...e, registration: c.registration };
    }
    if (c.action === "schedule") next = { ...e, schedule: c.schedule };
    if (c.action === "publication")
      next = {
        ...e,
        published: c.published,
        registration:
          e.registration && (!c.published || !e.published)
            ? { ...e.registration, enabled: false }
            : e.registration,
      };
    next = editionSchema.parse(next);
    const { slug: _slug, ...configuration } = next;
    void _slug;
    if (JSON.stringify(next) === JSON.stringify(e)) return;
    const revision = current.revision + 1;
    await tx
      .insert(editionRevisions)
      .values({ editionSlug: slug, version: revision, configuration });
    await tx
      .update(editionState)
      .set({
        configuration,
        configurationVersion: revision,
        configurationUpdatedAt: new Date(),
      })
      .where(eq(editionState.slug, slug));
    await tx.insert(editionEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      kind: `tournament_${c.action}`,
      detail: {
        entity: { type: "tournament", id: slug },
        before: {
          configuration: state.configuration,
          revision: current.revision,
        },
        after: { configuration, revision },
        ...("existingApplicationsPolicy" in c
          ? {
              existingApplicationsPolicy: c.existingApplicationsPolicy ?? null,
            }
          : {}),
      },
    });
  });
  return tournamentForAdmin(actor, slug);
}

export function publicEditionSummary(
  e: Edition,
  availability: ReturnType<typeof enrollmentState> | "unavailable",
) {
  return {
    slug: e.slug,
    name: e.name,
    season: e.season,
    summary: e.summary,
    status: e.status,
    timeZone: e.timeZone,
    branding: e.branding,
    rules: e.rules,
    eligibility: e.eligibility,
    schedule: e.schedule,
    registration: e.registration
      ? {
          opensAt: e.registration.opensAt,
          closesAt: e.registration.closesAt,
          withdrawUntil: e.registration.withdrawUntil,
          state: availability,
        }
      : null,
  };
}
