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
