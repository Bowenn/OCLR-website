import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  users,
  staffRoles,
  tournamentRounds,
  tournamentStages,
  mappools,
  mappoolEntries,
  mappoolEvents,
  fixtures,
  matchImports,
  matchResults,
  resultRevisions,
} from "../../src/db/schema";
import { mappoolCommand } from "../../src/lib/mappools";
import { fixtureCommand } from "../../src/lib/fixtures";
import { auditLog } from "../../src/lib/audit";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { assertTestDatabase } from "../database";
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 1270001, username: "Synthetic Round Admin" };
const mapper = { osuId: 1270002, username: "Synthetic Round Mappooler" };
const referee = { osuId: 1270003, username: "Synthetic Referee" };
const player = { osuId: 1270004, username: "Synthetic Player" };
const deletion = (id: string, version = 0) => ({
  action: "round_delete",
  roundId: id,
  expectedVersion: version,
  confirmed: true,
});
async function create(
  stage: "group" | "knockout" = "group",
  position = 1,
  slug = edition.slug,
) {
  const data = await mappoolCommand(admin, slug, {
    action: "round_create",
    stage,
    position,
    name: `Synthetic ${stage} ${position}`,
    confirmed: true,
  });
  return data.rounds.find(
    (round) => round.stage === stage && round.position === position,
  )!;
}
async function fixture(roundId: string) {
  return fixtureCommand(admin, edition.slug, {
    action: "create",
    confirmed: true,
    roundId,
    label: "Synthetic planned fixture",
    homeTeamId: null,
    awayTeamId: null,
    scheduledAt: null,
    timeZone: "UTC",
    status: "scheduled",
    mappoolId: null,
    position: 1,
    refereeIds: [],
    homeSourceId: null,
    homeSourceOutcome: null,
    awaySourceId: null,
    awaySourceOutcome: null,
  });
}
describe.skipIf(!url)("safe round deletion", () => {
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([edition, { ...edition, slug: "other-test-cup" }]);
    await db().insert(users).values([admin, mapper, referee, player]);
    await db()
      .insert(staffRoles)
      .values([
        {
          userId: mapper.osuId,
          role: "mappooler",
          editionSlug: edition.slug,
          grantedBy: admin.osuId,
        },
        {
          userId: referee.osuId,
          role: "referee",
          editionSlug: edition.slug,
          grantedBy: admin.osuId,
        },
      ]);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it.each(["group", "knockout"] as const)(
    "deletes only the empty %s round without renumbering siblings or losing history",
    async (stage) => {
      await create(stage, 1);
      const target = await create(stage, 2);
      await create(stage, 3);
      const original = await db()
        .select()
        .from(tournamentRounds)
        .orderBy(tournamentRounds.position);
      const result = await mappoolCommand(
        mapper,
        edition.slug,
        deletion(target.id),
      );
      expect(result.rounds.map((round) => round.position)).toEqual([1, 3]);
      expect(
        await db()
          .select()
          .from(tournamentRounds)
          .orderBy(tournamentRounds.position),
      ).toEqual(original.filter((round) => round.id !== target.id));
      expect(await db().select().from(tournamentStages)).toHaveLength(1);
      const log = await auditLog(admin, {
        module: "mappools",
        action: "round_delete",
      });
      expect(log.total).toBe(1);
      expect(log.rows[0]).toMatchObject({
        entityType: "round",
        entityId: target.id,
        actorId: mapper.osuId,
        before: { id: target.id, version: 0 },
        after: { id: target.id, deleted: true },
      });
      expect(
        (await db().select().from(mappoolEvents)).filter(
          (event) => event.action === "round_create",
        ),
      ).toHaveLength(3);
      await expect(
        mappoolCommand(admin, edition.slug, deletion(target.id)),
      ).rejects.toMatchObject({ status: 404 });
      expect((await auditLog(admin, { action: "round_delete" })).total).toBe(1);
    },
  );
  it.each(["draft", "published", "locked"] as const)(
    "does not cascade into a %s pool or its maps",
    async (state) => {
      const round = await create();
      const [pool] = await db()
        .insert(mappools)
        .values({
          editionSlug: edition.slug,
          roundId: round.id,
          name: "Synthetic dependent pool",
          publishedAt: state === "published" ? new Date() : null,
          lockedAt: state === "locked" ? new Date() : null,
        })
        .returning();
      await db()
        .insert(mappoolEntries)
        .values({
          poolId: pool.id,
          category: "NM",
          position: 1,
          beatmapId: 123,
          metadata: {
            setId: 1,
            title: "Synthetic",
            artist: "Synthetic",
            difficulty: "Test",
            mapper: "Synthetic",
            stars: 4,
            bpm: 180,
            duration: 120,
          },
        });
      const savedMaps = await db().select().from(mappoolEntries),
        savedPools = await db().select().from(mappools),
        events = await db().select().from(mappoolEvents);
      await expect(
        mappoolCommand(admin, edition.slug, deletion(round.id)),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db().select().from(mappoolEntries)).toEqual(savedMaps);
      expect(await db().select().from(mappools)).toEqual(savedPools);
      expect(await db().select().from(mappoolEvents)).toEqual(events);
      expect(await db().select().from(tournamentRounds)).toHaveLength(1);
    },
  );
  it("retains planned fixtures and approved result history", async () => {
    const round = await create();
    const data = await fixture(round.id);
    const match = data.fixtures[0];
    await expect(
      mappoolCommand(admin, edition.slug, deletion(round.id)),
    ).rejects.toMatchObject({ status: 409 });
    const [source] = await db()
      .insert(matchImports)
      .values({
        fixtureId: match.id,
        externalMatchId: 127001,
        fingerprint: "synthetic-approved",
        source: { synthetic: true },
        createdBy: admin.osuId,
      })
      .returning();
    await db()
      .insert(matchResults)
      .values({
        fixtureId: match.id,
        state: "approved",
        currentRevision: 1,
        latestImportId: source.id,
        publishedRevision: 1,
        publishedAt: new Date(),
      });
    await db()
      .insert(resultRevisions)
      .values({
        fixtureId: match.id,
        revision: 1,
        importId: source.id,
        proposal: { historical: true },
        createdBy: admin.osuId,
        approvedBy: admin.osuId,
        approvedAt: new Date(),
      });
    const history = await db().select().from(resultRevisions);
    await expect(
      mappoolCommand(admin, edition.slug, deletion(round.id)),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db().select().from(resultRevisions)).toEqual(history);
    expect(await db().select().from(fixtures)).toHaveLength(1);
    expect((await auditLog(admin, { action: "round_delete" })).total).toBe(0);
  });
  it("enforces scopes, confirmation, current versions and immediate role revocation", async () => {
    const target = await create();
    const foreign = await create("group", 1, "other-test-cup");
    for (const actor of [referee, player])
      await expect(
        mappoolCommand(actor, edition.slug, deletion(target.id)),
      ).rejects.toMatchObject({ status: 403 });
    await expect(
      mappoolCommand(mapper, "other-test-cup", deletion(foreign.id)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      mappoolCommand(admin, edition.slug, deletion(foreign.id)),
    ).rejects.toMatchObject({ status: 404 });
    for (const input of [
      { ...deletion(target.id), confirmed: false },
      { ...deletion(target.id), actorId: admin.osuId },
      { ...deletion(target.id), expectedVersion: -1 },
    ])
      await expect(
        mappoolCommand(admin, edition.slug, input),
      ).rejects.toMatchObject({ status: 400 });
    await mappoolCommand(admin, edition.slug, {
      action: "round_edit",
      roundId: target.id,
      expectedVersion: 0,
      name: "Changed",
      position: 1,
      confirmed: true,
    });
    await expect(
      mappoolCommand(admin, edition.slug, deletion(target.id)),
    ).rejects.toMatchObject({ status: 409 });
    await db()
      .update(staffRoles)
      .set({ revokedAt: new Date() })
      .where(eq(staffRoles.userId, mapper.osuId));
    await expect(
      mappoolCommand(mapper, edition.slug, deletion(target.id, 1)),
    ).rejects.toMatchObject({ status: 403 });
    expect((await auditLog(admin, { action: "round_delete" })).total).toBe(0);
  });
  it.each(["pool", "fixture"] as const)(
    "serializes deletion with concurrent %s creation",
    async (kind) => {
      const round = await create();
      const results = await Promise.allSettled([
        mappoolCommand(admin, edition.slug, deletion(round.id)),
        kind === "pool"
          ? mappoolCommand(admin, edition.slug, {
              action: "pool_create",
              roundId: round.id,
              name: "Concurrent pool",
              confirmed: true,
            })
          : fixture(round.id),
      ]);
      expect(
        results.filter((result) => result.status === "fulfilled"),
      ).toHaveLength(1);
      const remaining = await db().select().from(tournamentRounds);
      for (const dependency of [
        ...(await db().select().from(mappools)),
        ...(await db().select().from(fixtures)),
      ])
        expect(remaining.some((round) => round.id === dependency.roundId)).toBe(
          true,
        );
      expect((await auditLog(admin, { action: "round_delete" })).total).toBe(
        results[0].status === "fulfilled" ? 1 : 0,
      );
    },
  );
  it("rolls deletion back if its audit write fails", async () => {
    const round = await create();
    await db().execute(
      sql`CREATE FUNCTION reject_round_delete_test() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.action='round_delete' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$`,
    );
    try {
      await db().execute(
        sql`CREATE TRIGGER reject_round_delete_test BEFORE INSERT ON mappool_events FOR EACH ROW EXECUTE FUNCTION reject_round_delete_test()`,
      );
      await expect(
        mappoolCommand(admin, edition.slug, deletion(round.id)),
      ).rejects.toThrow();
      expect((await db().select().from(tournamentRounds))[0].id).toBe(round.id);
      expect(
        (await db().select().from(mappoolEvents)).map((event) => event.action),
      ).toEqual(["round_create"]);
    } finally {
      await db().execute(
        sql`DROP TRIGGER IF EXISTS reject_round_delete_test ON mappool_events`,
      );
      await db().execute(sql`DROP FUNCTION reject_round_delete_test()`);
    }
  });
});
