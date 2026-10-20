import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  captains,
  draftPicks,
  draftSessions,
  editionEvents,
  editionState,
  memberships,
  registrations,
  teams,
  users,
} from "@/db/schema";
import { assertCapability, hasCapability } from "./auth/staff";
import type { User } from "./auth/sessions";
import { hashToken } from "./auth/tokens";
import { getEdition, getPublicEdition } from "./content";
import { HttpError } from "./http";
import type {
  CaptainBoard,
  DraftBoard,
  DraftIdentity,
  DraftTeam,
} from "./draft-types";
type Reader = Pick<ReturnType<typeof db>, "select">;
async function draftData(tx: Reader, slug: string) {
  const [session] = await tx
    .select()
    .from(draftSessions)
    .where(eq(draftSessions.editionSlug, slug));
  const [edition] = await tx
    .select()
    .from(editionState)
    .where(eq(editionState.slug, slug));
  const teamRows = await tx
    .select({
      team: teams,
      captainName: users.username,
      captainPublished: captains.published,
    })
    .from(teams)
    .innerJoin(
      captains,
      and(
        eq(captains.editionSlug, teams.editionSlug),
        eq(captains.userId, teams.captainId),
      ),
    )
    .innerJoin(users, eq(users.osuId, teams.captainId))
    .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)))
    .orderBy(captains.position);
  const members = await tx
    .select({ membership: memberships, username: users.username })
    .from(memberships)
    .innerJoin(users, eq(users.osuId, memberships.userId))
    .where(and(eq(memberships.editionSlug, slug), isNull(memberships.leftAt)))
    .orderBy(memberships.joinedAt);
  const picks = session
    ? await tx
        .select()
        .from(draftPicks)
        .where(eq(draftPicks.sessionId, session.id))
        .orderBy(draftPicks.turnIndex, draftPicks.createdAt)
    : [];
  const identities = session?.pool.length
    ? await tx
        .select({ osuId: users.osuId, username: users.username })
        .from(users)
        .where(inArray(users.osuId, session.pool))
    : [];
  return {
    session: session ?? null,
    edition: edition ?? null,
    teams: teamRows,
    members,
    picks,
    identities,
  };
}
type Data = Awaited<ReturnType<typeof draftData>>;
function availablePool(data: Data) {
  return data.identities.filter(
    (p) => !data.members.some((m) => m.membership.userId === p.osuId),
  );
}
function board(data: Data): DraftBoard {
  const session = data.session!;
  if (data.teams.some((t) => !t.team.identityPublished || !t.captainPublished))
    throw new HttpError(
      409,
      "Approve and publish all captain/team identities before publishing the draft.",
    );
  const teamMap = new Map<string, DraftTeam>(
    data.teams.map(({ team, captainName }) => [
      team.id,
      {
        id: team.id,
        name: team.name,
        captain: { osuId: team.captainId, username: captainName },
      },
    ]),
  );
  const identityMap = new Map<number, DraftIdentity>(
    data.identities.map((p) => [p.osuId, p]),
  );
  return {
    sessionId: session.id,
    version: session.publicVersion + 1,
    state: session.state,
    turnIndex: session.turnIndex,
    turnCount: session.turnSequence.length,
    activeTeam: ["ready", "live", "paused"].includes(session.state)
      ? (teamMap.get(session.turnSequence[session.turnIndex]) ?? null)
      : null,
    picks: data.picks
      .filter((p) => !p.voidedAt)
      .map((p) => {
        const team = teamMap.get(p.teamId);
        const player = identityMap.get(p.playerId);
        if (!team || !player)
          throw new HttpError(
            409,
            "Draft identity integrity requires staff recovery.",
          );
        return { id: p.id, turnIndex: p.turnIndex, team, player };
      }),
    rosters: data.teams.map(({ team }) => ({
      team: teamMap.get(team.id)!,
      players: data.members
        .filter((m) => m.membership.teamId === team.id)
        .map((m) => ({ osuId: m.membership.userId, username: m.username })),
    })),
    pool: data.edition?.poolPublished ? availablePool(data) : null,
  };
}
export async function staffDraft(actor: User, slug: string) {
  await assertCapability(actor, "manage_draft", slug);
  if (!(await getEdition(slug))) throw new HttpError(404, "Edition not found.");
  return db().transaction(
    async (tx) => {
      const data = await draftData(tx, slug);
      const events = await tx
        .select()
        .from(editionEvents)
        .where(eq(editionEvents.editionSlug, slug))
        .orderBy(editionEvents.createdAt);
      return { ...data, availablePool: availablePool(data), events };
    },
    { isolationLevel: "repeatable read" },
  );
}
export type StaffDraft = Awaited<ReturnType<typeof staffDraft>>;
export async function publicDraft(slug: string) {
  if (!(await getPublicEdition(slug)) || !process.env.DATABASE_URL) return null;
  return db().transaction(
    async (tx) => {
      const [row] = await tx
        .select({ snapshot: draftSessions.publicSnapshot })
        .from(draftSessions)
        .where(eq(draftSessions.editionSlug, slug));
      if (!row?.snapshot) return null;
      const approved = await tx
        .select({ id: teams.id })
        .from(teams)
        .innerJoin(
          captains,
          and(
            eq(captains.editionSlug, teams.editionSlug),
            eq(captains.userId, teams.captainId),
          ),
        )
        .where(
          and(
            eq(teams.editionSlug, slug),
            isNull(teams.archivedAt),
            eq(teams.identityPublished, true),
            eq(captains.published, true),
          ),
        );
      if (
        !row.snapshot.rosters.every((r) =>
          approved.some((t) => t.id === r.team.id),
        )
      )
        return null;
      const [visibility] = await tx
        .select({ poolPublished: editionState.poolPublished })
        .from(editionState)
        .where(eq(editionState.slug, slug));
      return visibility?.poolPublished
        ? row.snapshot
        : { ...row.snapshot, pool: null };
    },
    { isolationLevel: "repeatable read" },
  );
}
export async function captainDraft(
  actor: User,
  slug: string,
): Promise<CaptainBoard | null> {
  if (!(await getPublicEdition(slug)))
    throw new HttpError(404, "Edition not found.");
  const [appointment] = await db()
    .select()
    .from(captains)
    .where(
      and(eq(captains.editionSlug, slug), eq(captains.userId, actor.osuId)),
    );
  if (!appointment)
    throw new HttpError(403, "Captain access for this edition is required.");
  if (!(await publicDraft(slug))) return null;
  const [session] = await db()
    .select({ snapshot: draftSessions.captainSnapshot })
    .from(draftSessions)
    .where(eq(draftSessions.editionSlug, slug));
  return session?.snapshot ?? null;
}
const commandSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    confirmed: z.literal(true),
    command: z.discriminatedUnion("action", [
      z
        .object({
          action: z.literal("configure"),
          turnSequence: z.array(z.uuid()).max(4096),
        })
        .strict(),
      ...(
        [
          "ready",
          "start",
          "pause",
          "resume",
          "publish",
          "undo",
          "abort",
          "recover",
          "finalize",
        ] as const
      ).map((action) => z.object({ action: z.literal(action) }).strict()),
    ]),
  })
  .strict();
export async function draftCommand(actor: User, slug: string, input: unknown) {
  await assertCapability(actor, "manage_draft", slug);
  if (!(await getEdition(slug))) throw new HttpError(404, "Edition not found.");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Confirm a valid draft command.");
  const { expectedVersion, command } = parsed.data;
  await db().transaction(async (tx) => {
    const [edition] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    if (!edition)
      throw new HttpError(409, "Configure captains and teams first.");
    if (command.action === "configure")
      await tx
        .insert(draftSessions)
        .values({ editionSlug: slug })
        .onConflictDoNothing();
    const [session] = await tx
      .select()
      .from(draftSessions)
      .where(eq(draftSessions.editionSlug, slug))
      .for("update");
    if (!session || session.version !== expectedVersion)
      throw new HttpError(
        409,
        "Draft revision changed. Refresh the current snapshot.",
      );
    const before = {
      state: session.state,
      version: session.version,
      turnIndex: session.turnIndex,
      turnSequence: session.turnSequence,
      pool: session.pool,
      publishedRevision: session.publishedRevision,
      publicVersion: session.publicVersion,
    };
    if (command.action === "publish") {
      if (session.state === "setup")
        throw new HttpError(409, "Freeze and review setup before publication.");
      const data = await draftData(tx, slug);
      const snapshot = board(data);
      const captainSnapshot: CaptainBoard = {
        ...snapshot,
        engineRevision: session.version,
        turnSequence: session.turnSequence,
        eligiblePool: availablePool(data),
      };
      await tx
        .update(draftSessions)
        .set({
          publicSnapshot: snapshot,
          captainSnapshot,
          publicVersion: snapshot.version,
          publishedRevision: session.version,
        })
        .where(eq(draftSessions.id, session.id));
      await tx.insert(editionEvents).values({
        editionSlug: slug,
        actorId: actor.osuId,
        kind: "draft_publish",
        detail: {
          entity: { type: "draft_session", id: session.id },
          before: {
            publicVersion: session.publicVersion,
            publishedRevision: session.publishedRevision,
          },
          after: {
            publicVersion: snapshot.version,
            publishedRevision: session.version,
          },
          revision: session.version,
          publicVersion: snapshot.version,
        },
      });
      return;
    }
    const update: Partial<typeof draftSessions.$inferInsert> = {
      version: session.version + 1,
    };
    if (command.action === "configure") {
      if (session.state !== "setup" || !edition.lockedAt)
        throw new HttpError(
          409,
          "Lock reviewed captain/team setup before configuring the draft.",
        );
      const data = await draftData(tx, slug);
      if (
        command.turnSequence.some(
          (id) => !data.teams.some((t) => t.team.id === id),
        )
      )
        throw new HttpError(
          400,
          "Every turn must reference a current edition team.",
        );
      update.turnSequence = command.turnSequence;
    } else if (command.action === "ready") {
      if (session.state !== "setup" || !edition.lockedAt)
        throw new HttpError(409, "Draft setup is not ready to freeze.");
      const data = await draftData(tx, slug);
      const accepted = await tx
        .select()
        .from(registrations)
        .where(
          and(
            eq(registrations.editionSlug, slug),
            eq(registrations.status, "accepted"),
            isNull(registrations.draftUnavailableReason),
          ),
        );
      const appointed = await tx
        .select()
        .from(captains)
        .where(eq(captains.editionSlug, slug));
      if (
        !appointed.length ||
        data.teams.length !== appointed.length ||
        data.teams.some(
          (t) =>
            !accepted.some((p) => p.userId === t.team.captainId) ||
            !data.members.some(
              (m) =>
                m.membership.teamId === t.team.id &&
                m.membership.userId === t.team.captainId,
            ),
        ) ||
        data.members.length !== data.teams.length ||
        data.members.some((m) => m.membership.origin !== "captain")
      )
        throw new HttpError(
          409,
          "Verify accepted captains and clean team membership before freezing.",
        );
      const pool = accepted
        .filter(
          (p) =>
            !appointed.some((c) => c.userId === p.userId) &&
            !data.members.some((m) => m.membership.userId === p.userId),
        )
        .map((p) => p.userId);
      if (session.turnSequence.length > pool.length)
        throw new HttpError(
          409,
          "The configured turns exceed the eligible pool.",
        );
      for (const { team } of data.teams)
        if (
          team.capacity !== null &&
          1 + session.turnSequence.filter((id) => id === team.id).length >
            team.capacity
        )
          throw new HttpError(
            409,
            "The turn sequence exceeds an approved team capacity.",
          );
      update.state = "ready";
      update.pool = pool;
    } else if (command.action === "start") {
      if (session.state !== "ready")
        throw new HttpError(409, "Only a ready draft can start.");
      update.state = session.turnSequence.length ? "live" : "completed";
    } else if (command.action === "pause") {
      if (session.state !== "live")
        throw new HttpError(409, "Only a live draft can pause.");
      update.state = "paused";
    } else if (command.action === "resume") {
      if (session.state !== "paused")
        throw new HttpError(409, "Only a paused draft can resume.");
      update.state = "live";
    } else if (command.action === "undo") {
      if (!["paused", "completed"].includes(session.state))
        throw new HttpError(
          409,
          "Pause before supervised correction. Finalized drafts cannot be edited.",
        );
      const data = await draftData(tx, slug);
      const active = data.picks.filter((p) => !p.voidedAt);
      const last = active.at(-1);
      if (!last || last.turnIndex !== session.turnIndex - 1)
        throw new HttpError(409, "No safe last-pick correction is available.");
      const changed = await tx
        .update(memberships)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(memberships.teamId, last.teamId),
            eq(memberships.userId, last.playerId),
            eq(memberships.origin, "draft"),
            isNull(memberships.leftAt),
          ),
        )
        .returning();
      if (changed.length !== 1)
        throw new HttpError(
          409,
          "Roster integrity requires operator recovery.",
        );
      await tx
        .update(draftPicks)
        .set({ voidedAt: new Date() })
        .where(eq(draftPicks.id, last.id));
      update.state = "paused";
      update.turnIndex = last.turnIndex;
      await tx.insert(editionEvents).values({
        editionSlug: slug,
        actorId: actor.osuId,
        kind: "draft_pick_voided",
        detail: {
          entity: { type: "draft_pick", id: last.id },
          before: last,
          after: { voided: true, turnIndex: last.turnIndex },
        },
      });
    } else if (command.action === "abort") {
      if (!["setup", "ready", "paused", "completed"].includes(session.state))
        throw new HttpError(
          409,
          "Pause before aborting; finalized drafts cannot be aborted.",
        );
      const data = await draftData(tx, slug);
      await tx
        .update(draftPicks)
        .set({ voidedAt: new Date() })
        .where(
          and(
            eq(draftPicks.sessionId, session.id),
            isNull(draftPicks.voidedAt),
          ),
        );
      await tx
        .update(memberships)
        .set({ leftAt: new Date() })
        .where(
          and(
            eq(memberships.editionSlug, slug),
            eq(memberships.origin, "draft"),
            isNull(memberships.leftAt),
          ),
        );
      update.state = "aborted";
      update.turnIndex = 0;
      await tx.insert(editionEvents).values({
        editionSlug: slug,
        actorId: actor.osuId,
        kind: "draft_abort_picks",
        detail: {
          entity: { type: "draft_session", id: session.id },
          before: data.picks.filter((p) => !p.voidedAt),
          after: { activePicks: [] },
        },
      });
    } else if (command.action === "recover") {
      if (session.state !== "aborted")
        throw new HttpError(
          409,
          "Only an explicitly aborted draft can be reconfigured.",
        );
      update.state = "setup";
      update.pool = [];
      update.turnSequence = [];
      update.turnIndex = 0;
      update.publicSnapshot = null;
      update.captainSnapshot = null;
      update.publicVersion = session.publicVersion + 1;
      update.publishedRevision = -1;
      await tx
        .update(editionState)
        .set({ lockedAt: null, setupVersion: edition.setupVersion + 1 })
        .where(eq(editionState.slug, slug));
    } else if (command.action === "finalize") {
      if (
        session.state !== "completed" ||
        session.publishedRevision !== session.version
      )
        throw new HttpError(
          409,
          "Complete and publish all picks before finalization.",
        );
      const data = await draftData(tx, slug);
      const active = data.picks.filter((p) => !p.voidedAt);
      if (
        data.members.length !== data.teams.length + active.length ||
        active.length !== session.turnSequence.length ||
        active.some(
          (p, i) =>
            p.turnIndex !== i ||
            p.teamId !== session.turnSequence[i] ||
            !data.members.some(
              (m) =>
                m.membership.teamId === p.teamId &&
                m.membership.userId === p.playerId,
            ),
        ) ||
        data.teams.some(
          (t) =>
            t.team.capacity !== null &&
            data.members.filter((m) => m.membership.teamId === t.team.id)
              .length > t.team.capacity,
        )
      )
        throw new HttpError(409, "Draft/roster invariants are not satisfied.");
      await tx
        .update(teams)
        .set({ finalizedAt: new Date(), rosterPublished: false })
        .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)));
      update.state = "finalized";
    }
    await tx
      .update(draftSessions)
      .set(update)
      .where(eq(draftSessions.id, session.id));
    await tx.insert(editionEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      kind: `draft_${command.action}`,
      detail: {
        entity: { type: "draft_session", id: session.id },
        before,
        after: { ...before, ...update },
        command,
      },
    });
  });
  return staffDraft(actor, slug);
}
const pickInput = z
  .object({
    sessionId: z.uuid(),
    turnIndex: z.number().int().nonnegative(),
    candidateId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    expectedVersion: z.number().int().nonnegative(),
    idempotencyKey: z.uuid(),
  })
  .strict();
export async function pickPlayer(actor: User, slug: string, input: unknown) {
  if (!(await getPublicEdition(slug)))
    throw new HttpError(404, "Tournament not found.");
  const parsed = pickInput.safeParse(input);
  if (!parsed.success)
    throw new HttpError(
      400,
      "Send a valid pick with the current turn and revision.",
    );
  const value = parsed.data;
  const requestHash = hashToken(
    JSON.stringify({
      sessionId: value.sessionId,
      turnIndex: value.turnIndex,
      candidateId: value.candidateId,
      expectedVersion: value.expectedVersion,
    }),
  );
  return db().transaction(async (tx) => {
    const [edition] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    const [session] = await tx
      .select()
      .from(draftSessions)
      .where(
        and(
          eq(draftSessions.id, value.sessionId),
          eq(draftSessions.editionSlug, slug),
        ),
      )
      .for("update");
    if (!edition?.lockedAt || !session)
      throw new HttpError(409, "Draft session is not available.");
    const [appointment] = await tx
      .select()
      .from(captains)
      .where(
        and(eq(captains.editionSlug, slug), eq(captains.userId, actor.osuId)),
      );
    const staff = await hasCapability(actor, "manage_draft", slug, tx);
    if (!staff && !appointment)
      throw new HttpError(
        403,
        "Only an appointed captain or authorized staff can pick.",
      );
    const [previous] = await tx
      .select()
      .from(draftPicks)
      .where(
        and(
          eq(draftPicks.sessionId, session.id),
          eq(draftPicks.actorId, actor.osuId),
          eq(draftPicks.requestKey, value.idempotencyKey),
        ),
      );
    if (previous) {
      if (previous.requestHash !== requestHash)
        throw new HttpError(
          409,
          "An idempotency key cannot be reused for another request.",
        );
      return {
        pickId: previous.id,
        turnIndex: previous.turnIndex,
        teamId: previous.teamId,
        playerId: previous.playerId,
        corrected: Boolean(previous.voidedAt),
      };
    }
    const [team] = await tx
      .select()
      .from(teams)
      .where(
        and(
          eq(
            teams.id,
            session.turnSequence[session.turnIndex] ??
              "00000000-0000-0000-0000-000000000000",
          ),
          eq(teams.editionSlug, slug),
          isNull(teams.archivedAt),
        ),
      );
    if (
      session.state !== "live" ||
      session.version !== value.expectedVersion ||
      session.turnIndex !== value.turnIndex ||
      session.publishedRevision !== session.version ||
      !team
    )
      throw new HttpError(
        409,
        "Draft state changed or is awaiting publication. Refresh the authoritative snapshot.",
      );
    if (!staff && team?.captainId !== actor.osuId)
      throw new HttpError(403, "It is another captain’s turn.");
    const [assigned] = await tx
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.editionSlug, slug),
          eq(memberships.userId, value.candidateId),
          isNull(memberships.leftAt),
        ),
      );
    const roster = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.teamId, team.id), isNull(memberships.leftAt)));
    if (
      !session.pool.includes(value.candidateId) ||
      assigned ||
      (team.capacity !== null && roster.length >= team.capacity)
    )
      throw new HttpError(
        409,
        "This player is unavailable or the team is full. Refresh the current pool.",
      );
    const nextVersion = session.version + 1;
    const mode = staff ? "staff_on_behalf" : "captain_direct";
    const [pick] = await tx
      .insert(draftPicks)
      .values({
        sessionId: session.id,
        turnIndex: session.turnIndex,
        teamId: team.id,
        captainId: team.captainId,
        playerId: value.candidateId,
        actorId: actor.osuId,
        mode,
        requestKey: value.idempotencyKey,
        requestHash,
        revision: nextVersion,
      })
      .returning();
    await tx.insert(memberships).values({
      editionSlug: slug,
      teamId: team.id,
      userId: value.candidateId,
      origin: "draft",
    });
    const nextTurn = session.turnIndex + 1;
    await tx
      .update(draftSessions)
      .set({
        version: nextVersion,
        turnIndex: nextTurn,
        state: nextTurn === session.turnSequence.length ? "completed" : "live",
      })
      .where(eq(draftSessions.id, session.id));
    await tx.insert(editionEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      kind: "draft_pick",
      detail: {
        entity: { type: "draft_pick", id: pick.id },
        pickId: pick.id,
        mode,
        actorRole: staff ? "staff" : "captain",
        captainId: team.captainId,
        teamId: team.id,
        playerId: value.candidateId,
        before: { turnIndex: session.turnIndex, version: session.version },
        after: { turnIndex: nextTurn, version: nextVersion },
      },
    });
    return {
      pickId: pick.id,
      turnIndex: pick.turnIndex,
      teamId: pick.teamId,
      playerId: pick.playerId,
      corrected: false,
    };
  });
}
