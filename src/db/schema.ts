import { sql } from "drizzle-orm";
import {
  pgEnum,
  integer,
  boolean,
  primaryKey,
  foreignKey,
  uniqueIndex,
  jsonb,
  uuid,
  unique,
  bigint,
  index,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
export const users = pgTable("users", {
  osuId: bigint("osu_id", { mode: "number" }).primaryKey(),
  username: text("username").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const sessions = pgTable(
  "sessions",
  {
    tokenHash: text("token_hash").primaryKey(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("sessions_expiry_idx").on(table.expiresAt),
    index("sessions_user_idx").on(table.userId),
  ],
);
export const oauthStates = pgTable(
  "oauth_states",
  {
    stateHash: text("state_hash").primaryKey(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("oauth_states_expiry_idx").on(table.expiresAt)],
);

export const registrationStatus = pgEnum("registration_status", [
  "pending",
  "accepted",
  "rejected",
  "withdrawn",
]);
export const editionState = pgTable("edition_state", {
  slug: text("slug").primaryKey(),
  lockedAt: timestamp("locked_at", { withTimezone: true }),
  setupVersion: integer("setup_version").notNull().default(0),
  poolPublished: boolean("pool_published").notNull().default(false),
});
export const registrations = pgTable(
  "registrations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug")
      .notNull()
      .references(() => editionState.slug),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId, { onDelete: "cascade" }),
    status: registrationStatus("status").notNull().default("pending"),
    rulesVersion: text("rules_version").notNull(),
    answers: jsonb("answers").$type<Record<string, string>>().notNull(),
    statusReason: text("status_reason"),
    draftUnavailableReason: text("draft_unavailable_reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    unique("registrations_edition_user_unique").on(
      table.editionSlug,
      table.userId,
    ),
    index("registrations_status_idx").on(table.editionSlug, table.status),
  ],
);
export const registrationEvents = pgTable(
  "registration_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    registrationId: uuid("registration_id")
      .notNull()
      .references(() => registrations.id, { onDelete: "cascade" }),
    actorId: bigint("actor_id", { mode: "number" }).references(
      () => users.osuId,
      { onDelete: "set null" },
    ),
    fromStatus: registrationStatus("from_status"),
    toStatus: registrationStatus("to_status").notNull(),
    reason: text("reason"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("registration_events_registration_idx").on(table.registrationId),
  ],
);

export const captains = pgTable(
  "captains",
  {
    editionSlug: text("edition_slug")
      .notNull()
      .references(() => editionState.slug),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    position: integer("position").notNull(),
    published: boolean("published").notNull().default(false),
  },
  (table) => [
    primaryKey({ columns: [table.editionSlug, table.userId] }),
    unique("captains_edition_position_unique").on(
      table.editionSlug,
      table.position,
    ),
  ],
);
export const editionEvents = pgTable(
  "edition_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug")
      .notNull()
      .references(() => editionState.slug),
    actorId: bigint("actor_id", { mode: "number" }).references(
      () => users.osuId,
      { onDelete: "set null" },
    ),
    kind: text("kind").notNull(),
    reason: text("reason").notNull(),
    detail: jsonb("detail").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("edition_events_edition_idx").on(table.editionSlug)],
);

export const teams = pgTable(
  "teams",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug")
      .notNull()
      .references(() => editionState.slug),
    captainId: bigint("captain_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    name: text("name").notNull(),
    capacity: integer("capacity"),
    identityPublished: boolean("identity_published").notNull().default(false),
    rosterPublished: boolean("roster_published").notNull().default(false),
    finalizedAt: timestamp("finalized_at", { withTimezone: true }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
  },
  (table) => [
    unique("teams_id_edition_unique").on(table.id, table.editionSlug),
    uniqueIndex("teams_active_captain_unique")
      .on(table.editionSlug, table.captainId)
      .where(sql`${table.archivedAt} IS NULL`),
  ],
);
export const memberships = pgTable(
  "memberships",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug").notNull(),
    teamId: uuid("team_id").notNull(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    origin: text("origin").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (table) => [
    foreignKey({
      columns: [table.teamId, table.editionSlug],
      foreignColumns: [teams.id, teams.editionSlug],
    }),
    uniqueIndex("membership_active_edition_user_unique")
      .on(table.editionSlug, table.userId)
      .where(sql`${table.leftAt} IS NULL`),
    index("membership_team_idx").on(table.teamId),
  ],
);

export const draftState = pgEnum("draft_state", [
  "setup",
  "ready",
  "live",
  "paused",
  "completed",
  "finalized",
  "aborted",
]);
export const draftSessions = pgTable("draft_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  editionSlug: text("edition_slug")
    .notNull()
    .unique()
    .references(() => editionState.slug),
  state: draftState("state").notNull().default("setup"),
  version: integer("version").notNull().default(0),
  turnIndex: integer("turn_index").notNull().default(0),
  turnSequence: jsonb("turn_sequence").$type<string[]>().notNull().default([]),
  pool: jsonb("pool").$type<number[]>().notNull().default([]),
  publicVersion: integer("public_version").notNull().default(0),
  publishedRevision: integer("published_revision").notNull().default(-1),
  publicSnapshot:
    jsonb("public_snapshot").$type<import("../lib/draft-types").DraftBoard>(),
  captainSnapshot:
    jsonb("captain_snapshot").$type<
      import("../lib/draft-types").CaptainBoard
    >(),
});
export const draftPicks = pgTable(
  "draft_picks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => draftSessions.id),
    turnIndex: integer("turn_index").notNull(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id),
    captainId: bigint("captain_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    playerId: bigint("player_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    actorId: bigint("actor_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    mode: text("mode").$type<"captain_direct" | "staff_on_behalf">().notNull(),
    requestKey: uuid("request_key").notNull(),
    requestHash: text("request_hash").notNull(),
    revision: integer("revision").notNull(),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("draft_active_turn_unique")
      .on(table.sessionId, table.turnIndex)
      .where(sql`${table.voidedAt} IS NULL`),
    uniqueIndex("draft_active_player_unique")
      .on(table.sessionId, table.playerId)
      .where(sql`${table.voidedAt} IS NULL`),
    unique("draft_actor_request_unique").on(
      table.sessionId,
      table.actorId,
      table.requestKey,
    ),
  ],
);

export const staffRole = pgEnum("staff_role", [
  "admin",
  "mappooler",
  "referee",
]);
export const staffRoles = pgTable(
  "staff_roles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId, { onDelete: "cascade" }),
    editionSlug: text("edition_slug").references(() => editionState.slug),
    role: staffRole("role").notNull(),
    grantedBy: bigint("granted_by", { mode: "number" }).notNull(),
    grantedAt: timestamp("granted_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("staff_global_role_unique")
      .on(t.userId, t.role)
      .where(sql`${t.editionSlug} IS NULL AND ${t.revokedAt} IS NULL`),
    uniqueIndex("staff_scoped_role_unique")
      .on(t.userId, t.role, t.editionSlug)
      .where(sql`${t.editionSlug} IS NOT NULL AND ${t.revokedAt} IS NULL`),
    index("staff_roles_user_idx").on(t.userId),
  ],
);
export const staffRoleEvents = pgTable(
  "staff_role_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    grantId: uuid("grant_id")
      .notNull()
      .references(() => staffRoles.id, { onDelete: "cascade" }),
    actorId: bigint("actor_id", { mode: "number" }).notNull(),
    targetId: bigint("target_id", { mode: "number" }).notNull(),
    role: staffRole("role").notNull(),
    editionSlug: text("edition_slug"),
    action: text("action").$type<"grant" | "revoke">().notNull(),
    reason: text("reason").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("staff_role_events_grant_idx").on(t.grantId)],
);

export const stageKind = pgEnum("stage_kind", ["group", "knockout"]);
export const tournamentStages = pgTable(
  "tournament_stages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug")
      .notNull()
      .references(() => editionState.slug),
    kind: stageKind("kind").notNull(),
  },
  (t) => [
    unique("stage_edition_kind_unique").on(t.editionSlug, t.kind),
    unique("stage_id_edition_unique").on(t.id, t.editionSlug),
  ],
);
export const tournamentRounds = pgTable(
  "tournament_rounds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug").notNull(),
    stageId: uuid("stage_id").notNull(),
    name: text("name").notNull(),
    position: integer("position").notNull(),
    version: integer("version").notNull().default(0),
  },
  (t) => [
    foreignKey({
      columns: [t.stageId, t.editionSlug],
      foreignColumns: [tournamentStages.id, tournamentStages.editionSlug],
    }),
    unique("round_stage_position_unique").on(t.stageId, t.position),
    unique("round_id_edition_unique").on(t.id, t.editionSlug),
  ],
);
export const mappoolCategory = pgEnum("mappool_category", [
  "NM",
  "HD",
  "DT",
  "HR",
  "FM",
  "TB",
]);
export const fmMode = pgEnum("fm_mode", ["free_mod", "force_mod"]);
export const mappools = pgTable(
  "mappools",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug").notNull(),
    roundId: uuid("round_id").notNull(),
    name: text("name").notNull(),
    fmMode: fmMode("fm_mode"),
    fmRestrictions: text("fm_restrictions").notNull().default(""),
    version: integer("version").notNull().default(0),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    foreignKey({
      columns: [t.roundId, t.editionSlug],
      foreignColumns: [tournamentRounds.id, tournamentRounds.editionSlug],
    }),
    unique("pool_round_name_unique").on(t.roundId, t.name),
    unique("pool_id_edition_unique").on(t.id, t.editionSlug),
    index("pool_public_edition_idx").on(t.editionSlug, t.publishedAt),
  ],
);
export const mappoolEntries = pgTable(
  "mappool_entries",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    poolId: uuid("pool_id")
      .notNull()
      .references(() => mappools.id),
    category: mappoolCategory("category").notNull(),
    position: integer("position").notNull(),
    beatmapId: bigint("beatmap_id", { mode: "number" }).notNull(),
    metadata: jsonb("metadata")
      .$type<import("../lib/osu-beatmaps").BeatmapMetadata>()
      .notNull(),
    metadataFetchedAt: timestamp("metadata_fetched_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    unique("pool_slot_unique").on(t.poolId, t.category, t.position),
    index("pool_entry_pool_idx").on(t.poolId),
  ],
);
export const mappoolEvents = pgTable(
  "mappool_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    editionSlug: text("edition_slug")
      .notNull()
      .references(() => editionState.slug),
    poolId: uuid("pool_id").references(() => mappools.id),
    actorId: bigint("actor_id", { mode: "number" }).notNull(),
    action: text("action").notNull(),
    reason: text("reason").notNull(),
    before: jsonb("before").$type<Record<string, unknown>>(),
    after: jsonb("after").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [index("mappool_events_pool_idx").on(t.poolId)],
);
