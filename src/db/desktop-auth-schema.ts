import {
  pgTable,
  uuid,
  text,
  jsonb,
  timestamp,
  bigint,
  integer,
  index,
} from "drizzle-orm/pg-core";
import { users } from "./schema";
export const desktopAuthorizations = pgTable("desktop_authorizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  deviceName: text("device_name").notNull(),
  platform: text("platform").notNull(),
  redirectUri: text("redirect_uri").notNull(),
  state: text("state").notNull(),
  challenge: text("challenge").notNull(),
  scopes: jsonb("scopes").$type<string[]>().notNull(),
  verificationCode: text("verification_code").notNull(),
  status: text("status").notNull().default("pending"),
  userId: bigint("user_id", { mode: "number" }).references(() => users.osuId),
  codeHash: text("code_hash"),
  failures: integer("failures").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const desktopSessions = pgTable(
  "desktop_sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: bigint("user_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    deviceName: text("device_name").notNull(),
    platform: text("platform").notNull(),
    scopes: jsonb("scopes").$type<string[]>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    refreshedAt: timestamp("refreshed_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    refreshExpiresAt: timestamp("refresh_expires_at", {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("desktop_session_user_idx").on(t.userId)],
);
export const desktopTokens = pgTable(
  "desktop_tokens",
  {
    hash: text("hash").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => desktopSessions.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    consumedAt: timestamp("consumed_at", { withTimezone: true }),
  },
  (t) => [index("desktop_token_session_idx").on(t.sessionId)],
);
export const desktopSecurityEvents = pgTable("desktop_security_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: bigint("user_id", { mode: "number" }),
  sessionId: uuid("session_id"),
  action: text("action").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
