import { and, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import {
  captains,
  editionEvents,
  editionState,
  memberships,
  teams,
  users,
  draftSessions,
} from "@/db/schema";
import type { User } from "./auth/sessions";
import { assertCapability } from "./auth/staff";
import { getEditions, getPublicEdition } from "./content";
import { HttpError } from "./http";
const teamInput = z
  .object({
    captainId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    name: z.string().trim().min(1).max(80),
    capacity: z.number().int().min(1).max(256).nullable(),
  })
  .strict();
const commandSchema = z
  .object({
    expectedVersion: z.number().int().nonnegative(),
    confirmed: z.literal(true),
    command: z.discriminatedUnion("action", [
      z
        .object({
          action: z.literal("configure"),
          teams: z.array(teamInput).min(1).max(256),
        })
        .strict(),
      z
        .object({
          action: z.literal("publish"),
          teamId: z.uuid(),
          identityPublished: z.boolean(),
          rosterPublished: z.boolean(),
        })
        .strict(),
    ]),
  })
  .strict();
export async function staffTeams(actor: User, slug: string) {
  await assertCapability(actor, "manage_teams", slug);
  if (!(await getEditions()).some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  return db().transaction(
    async (tx) => {
      const [state] = await tx
        .select()
        .from(editionState)
        .where(eq(editionState.slug, slug));
      const rows = await tx
        .select()
        .from(teams)
        .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)))
        .orderBy(teams.name);
      const members = await tx
        .select({
          teamId: memberships.teamId,
          osuId: memberships.userId,
          username: users.username,
          origin: memberships.origin,
        })
        .from(memberships)
        .innerJoin(users, eq(users.osuId, memberships.userId))
        .where(
          and(eq(memberships.editionSlug, slug), isNull(memberships.leftAt)),
        )
        .orderBy(memberships.joinedAt);
      return {
        version: state?.setupVersion ?? 0,
        locked: Boolean(state?.lockedAt),
        teams: rows.map((team) => ({
          ...team,
          members: members.filter((m) => m.teamId === team.id),
        })),
      };
    },
    { isolationLevel: "repeatable read" },
  );
}
export async function updateTeams(actor: User, slug: string, input: unknown) {
  await assertCapability(actor, "manage_teams", slug);
  if (!(await getEditions()).some((e) => e.slug === slug))
    throw new HttpError(404, "Edition not found.");
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Confirm valid team configuration.");
  const { command, expectedVersion } = parsed.data;
  await db().transaction(async (tx) => {
    const [state] = await tx
      .select()
      .from(editionState)
      .where(eq(editionState.slug, slug))
      .for("update");
    if (!state || state.setupVersion !== expectedVersion)
      throw new HttpError(409, "Setup changed. Refresh before continuing.");
    const before = await tx
      .select()
      .from(teams)
      .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)));
    if (command.action === "configure") {
      if (state.lockedAt)
        throw new HttpError(
          409,
          "Team configuration is locked. Use supervised draft recovery.",
        );
      const appointed = await tx
        .select()
        .from(captains)
        .where(eq(captains.editionSlug, slug));
      if (
        command.teams.length !== appointed.length ||
        new Set(command.teams.map((t) => t.captainId)).size !==
          appointed.length ||
        appointed.some(
          (c) => !command.teams.some((t) => t.captainId === c.userId),
        )
      )
        throw new HttpError(
          400,
          "Configure exactly one team for every appointed captain.",
        );
      for (const value of command.teams) {
        const existing = before.find((t) => t.captainId === value.captainId);
        let teamId: string;
        if (existing) {
          if (existing.finalizedAt)
            throw new HttpError(409, "Finalized team identity is immutable.");
          await tx
            .update(teams)
            .set({
              name: value.name,
              capacity: value.capacity,
              identityPublished: false,
            })
            .where(eq(teams.id, existing.id));
          teamId = existing.id;
        } else {
          const [created] = await tx
            .insert(teams)
            .values({ editionSlug: slug, ...value })
            .returning();
          teamId = created.id;
          await tx.insert(memberships).values({
            editionSlug: slug,
            teamId,
            userId: value.captainId,
            origin: "captain",
          });
        }
      }
    } else {
      const team = before.find((t) => t.id === command.teamId);
      if (!team) throw new HttpError(404, "Team not found.");
      const [captain] = await tx
        .select()
        .from(captains)
        .where(
          and(
            eq(captains.editionSlug, slug),
            eq(captains.userId, team.captainId),
          ),
        );
      if (
        (command.identityPublished && !captain?.published) ||
        (command.rosterPublished &&
          (!command.identityPublished || !team.finalizedAt))
      )
        throw new HttpError(
          409,
          "Publish the captain first. Rosters require finalized teams and published identity.",
        );
      await tx
        .update(teams)
        .set({
          identityPublished: command.identityPublished,
          rosterPublished: command.rosterPublished,
        })
        .where(eq(teams.id, team.id));
    }
    await tx
      .update(editionState)
      .set({ setupVersion: state.setupVersion + 1 })
      .where(eq(editionState.slug, slug));
    const after = await tx
      .select()
      .from(teams)
      .where(and(eq(teams.editionSlug, slug), isNull(teams.archivedAt)));
    await tx.insert(editionEvents).values({
      editionSlug: slug,
      actorId: actor.osuId,
      kind: `team_${command.action}`,
      detail: {
        entity: { type: "team_setup", id: slug },
        before,
        after,
        fromVersion: expectedVersion,
        toVersion: expectedVersion + 1,
      },
    });
  });
  return staffTeams(actor, slug);
}
export async function ownTeam(userId: number, slug: string) {
  const [team] = await db()
    .select()
    .from(teams)
    .where(
      and(
        eq(teams.editionSlug, slug),
        eq(teams.captainId, userId),
        isNull(teams.archivedAt),
      ),
    );
  if (!team) return null;
  const members = await db()
    .select({
      osuId: memberships.userId,
      username: users.username,
      origin: memberships.origin,
    })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.osuId))
    .where(and(eq(memberships.teamId, team.id), isNull(memberships.leftAt)))
    .orderBy(memberships.joinedAt);
  const [session] = await db()
    .select({ snapshot: draftSessions.captainSnapshot })
    .from(draftSessions)
    .where(eq(draftSessions.editionSlug, slug));
  const published = session?.snapshot?.rosters.find(
    (r) => r.team.id === team.id,
  )?.players;
  return {
    ...team,
    finalizedAt:
      session && session.snapshot?.state !== "finalized"
        ? null
        : team.finalizedAt,
    members:
      published ??
      members
        .filter((m) => m.origin === "captain")
        .map(({ osuId, username }) => ({ osuId, username })),
  };
}
export async function publishedTeams(slug: string) {
  if (!(await getPublicEdition(slug)) || !process.env.DATABASE_URL) return [];
  return db().transaction(
    async (tx) => {
      const rows = await tx
        .select({
          id: teams.id,
          name: teams.name,
          captainId: teams.captainId,
          finalizedAt: teams.finalizedAt,
          rosterPublished: teams.rosterPublished,
        })
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
            eq(teams.identityPublished, true),
            eq(captains.published, true),
            isNull(teams.archivedAt),
          ),
        )
        .orderBy(teams.name);
      const published = [];
      for (const team of rows) {
        const members =
          team.finalizedAt && team.rosterPublished
            ? await tx
                .select({ osuId: memberships.userId, username: users.username })
                .from(memberships)
                .innerJoin(users, eq(users.osuId, memberships.userId))
                .where(
                  and(
                    eq(memberships.teamId, team.id),
                    isNull(memberships.leftAt),
                  ),
                )
                .orderBy(memberships.joinedAt)
            : null;
        published.push({
          id: team.id,
          name: team.name,
          captainId: team.captainId,
          finalized: Boolean(team.finalizedAt),
          members,
        });
      }
      return published;
    },
    { isolationLevel: "repeatable read" },
  );
}
