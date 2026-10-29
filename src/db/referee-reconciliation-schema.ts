import {
  pgTable,
  uuid,
  text,
  integer,
  bigint,
  timestamp,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { fixtures, users } from "./schema";

/** Append-only, private matching receipts; never an official result source. */
export const refereeReconciliations = pgTable(
  "referee_reconciliations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fixtureId: uuid("fixture_id")
      .notNull()
      .references(() => fixtures.id),
    actorId: bigint("actor_id", { mode: "number" })
      .notNull()
      .references(() => users.osuId),
    requestKey: uuid("request_key").notNull(),
    payloadHash: text("payload_hash").notNull(),
    revision: integer("revision").notNull(),
    sessionRevision: integer("session_revision").notNull(),
    dependencyFingerprint: text("dependency_fingerprint").notNull(),
    attemptId: uuid("attempt_id").notNull(),
    importId: uuid("import_id"),
    sourceFingerprint: text("source_fingerprint"),
    gameId: bigint("game_id", { mode: "number" }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    uniqueIndex("referee_reconciliation_request").on(
      t.fixtureId,
      t.actorId,
      t.requestKey,
    ),
    uniqueIndex("referee_reconciliation_revision").on(t.fixtureId, t.revision),
    index("referee_reconciliation_fixture").on(t.fixtureId),
  ],
);
