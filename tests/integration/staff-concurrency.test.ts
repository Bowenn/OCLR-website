import { assertTestDatabase } from "../database";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import { editionState, staffRoles, users } from "../../src/db/schema";
import { assertCapability } from "../../src/lib/auth/staff";
const url = process.env.TEST_DATABASE_URL;
const actor = { osuId: 280001, username: "Synthetic Scoped Referee" };
describe.skipIf(!url)(
  "authorization within concurrent database transactions",
  () => {
    beforeAll(() => {
      assertTestDatabase(url);
      vi.stubEnv("DATABASE_URL", url!);
      vi.stubEnv("ADMIN_OSU_IDS", "");
    });
    beforeEach(async () => {
      await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
      await db().insert(users).values(actor);
      await db().insert(editionState).values({ slug: "test-cup" });
      await db().insert(staffRoles).values({
        userId: actor.osuId,
        role: "referee",
        editionSlug: "test-cup",
        grantedBy: actor.osuId,
      });
    });
    afterAll(async () => {
      await closeDb();
      vi.unstubAllEnvs();
    });
    it("authorizes ten simultaneous transactions without requesting extra pool connections", async () => {
      let started = 0;
      let release!: () => void;
      const ready = new Promise<void>((resolve) => {
        release = resolve;
      });
      await Promise.all(
        Array.from({ length: 10 }, () =>
          db().transaction(async (tx) => {
            await tx.execute(sql`SELECT 1`);
            if (++started === 10) release();
            await ready;
            await assertCapability(actor, "record_results", "test-cup", tx);
          }),
        ),
      );
      expect(started).toBe(10);
    });
    it("rechecks committed role revocation on the same read-committed transaction", async () => {
      await db().transaction(async (tx) => {
        await assertCapability(actor, "record_results", "test-cup", tx);
        await db()
          .update(staffRoles)
          .set({ revokedAt: new Date() })
          .where(eq(staffRoles.userId, actor.osuId));
        await expect(
          assertCapability(actor, "record_results", "test-cup", tx),
        ).rejects.toMatchObject({ status: 403 });
      });
    });
  },
);
