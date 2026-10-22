import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  editionEvents,
  fixtureReferees,
  fixtures,
  matchImports,
  matchResults,
  resultAuditEvents,
  users,
} from "../../src/db/schema";
import { fixtureCommand, assignFixtureReferees } from "../../src/lib/fixtures";
import {
  publicFixture,
  publicCompetition,
} from "../../src/lib/public-competition";
import { auditLog } from "../../src/lib/audit";
import { mappoolCommand } from "../../src/lib/mappools";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { assertTestDatabase } from "../database";
const url = process.env.TEST_DATABASE_URL;
const actor = { osuId: 992001, username: "Synthetic deletion Admin" };
const base = {
  confirmed: true,
  label: "GS1 mistake",
  homeTeamId: null,
  awayTeamId: null,
  scheduledAt: null,
  timeZone: "UTC",
  status: "scheduled",
  mappoolId: null,
  position: 1,
  homeSourceId: null,
  homeSourceOutcome: null,
  awaySourceId: null,
  awaySourceOutcome: null,
};
describe.skipIf(!url)("safe unused fixture deletion", () => {
  let roundId: string, fixtureId: string;
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(actor.osuId));
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([edition, { ...edition, slug: "other-test-cup" }]);
    await db().insert(users).values(actor);
    const pool = await mappoolCommand(actor, edition.slug, {
      action: "round_create",
      stage: "knockout",
      name: "Synthetic QF",
      position: 1,
      confirmed: true,
    });
    roundId = pool.rounds[0].id;
    const result = await fixtureCommand(actor, edition.slug, {
      ...base,
      roundId,
      action: "create",
    });
    fixtureId = result.fixtures[0].id;
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  const deletion = (version = 0, assignment = 0) => ({
    action: "delete",
    fixtureId,
    expectedVersion: version,
    expectedAssignmentRevision: assignment,
    confirmed: true,
  });
  it("removes unused fixtures and harmless assignments, retains every audit event and allows position reuse", async () => {
    await assignFixtureReferees(actor, edition.slug, fixtureId, {
      expectedAssignmentRevision: 0,
      refereeIds: [actor.osuId],
    });
    const old = await db().select().from(resultAuditEvents);
    const result = await fixtureCommand(actor, edition.slug, deletion(0, 1));
    expect(result.fixtures).toHaveLength(0);
    expect(await db().select().from(fixtureReferees)).toHaveLength(0);
    expect(await db().select().from(resultAuditEvents)).toHaveLength(0);
    const history = await db().select().from(editionEvents);
    for (const event of old)
      expect(history.find((e) => e.id === event.id)).toMatchObject({
        actorId: event.actorId,
        createdAt: event.createdAt,
      });
    expect(
      history.find((e) => e.kind === "competition_fixture_delete")?.detail
        .before,
    ).toMatchObject({ id: fixtureId, label: base.label });
    expect(
      (
        await fixtureCommand(actor, edition.slug, {
          ...base,
          action: "create",
          roundId,
        })
      ).fixtures,
    ).toHaveLength(1);
  });
  it("retains filterable historical actors even when their account no longer exists", async () => {
    const historicalActor = 992099;
    const [event] = await db()
      .insert(resultAuditEvents)
      .values({
        fixtureId,
        actorId: historicalActor,
        action: "fixture_amend",
        detail: {
          before: { label: "Incorrect" },
          after: { label: base.label },
        },
      })
      .returning();
    await fixtureCommand(actor, edition.slug, deletion());
    const history = await auditLog(actor, { actor: String(historicalActor) });
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0]).toMatchObject({
      id: `edition:${event.id}`,
      actorId: historicalActor,
      action: "competition_fixture_amend",
      entityId: fixtureId,
      timestamp: event.createdAt.toISOString(),
    });
  });
  it("requires unpublish first and removes the fixture from every public projection", async () => {
    await fixtureCommand(actor, edition.slug, {
      action: "publish",
      fixtureId,
      expectedVersion: 0,
      published: true,
      confirmed: true,
    });
    expect(await publicFixture(edition.slug, fixtureId)).toBeTruthy();
    await expect(
      fixtureCommand(actor, edition.slug, deletion(1)),
    ).rejects.toMatchObject({ status: 409 });
    await fixtureCommand(actor, edition.slug, {
      action: "publish",
      fixtureId,
      expectedVersion: 1,
      published: false,
      confirmed: true,
    });
    await fixtureCommand(actor, edition.slug, deletion(2));
    expect(await publicFixture(edition.slug, fixtureId)).toBeFalsy();
    expect((await publicCompetition(edition.slug))!.fixtures).toHaveLength(0);
  });
  it("rejects incoming bracket source links until explicitly cleared", async () => {
    const maps = await mappoolCommand(actor, edition.slug, {
      action: "round_create",
      stage: "knockout",
      name: "Synthetic SF",
      position: 2,
      confirmed: true,
    });
    const round = maps.rounds.find((r) => r.position === 2)!;
    await fixtureCommand(actor, edition.slug, {
      ...base,
      action: "create",
      roundId: round.id,
      homeSourceId: fixtureId,
      homeSourceOutcome: "winner",
    });
    await expect(
      fixtureCommand(actor, edition.slug, deletion()),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db().select().from(fixtures)).toHaveLength(2);
  });
  it.each(["import", "result", "audit"])(
    "preserves protected %s history",
    async (kind) => {
      if (kind === "import")
        await db().insert(matchImports).values({
          fixtureId,
          externalMatchId: 1,
          fingerprint: "synthetic",
          source: {},
          createdBy: actor.osuId,
        });
      if (kind === "result")
        await db().insert(matchResults).values({ fixtureId });
      if (kind === "audit")
        await db().insert(resultAuditEvents).values({
          fixtureId,
          actorId: actor.osuId,
          action: "result_void",
          detail: {},
        });
      await expect(
        fixtureCommand(actor, edition.slug, deletion()),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db().select().from(fixtures)).toHaveLength(1);
    },
  );
  it("checks permissions, edition, fixture version and referee revision", async () => {
    await expect(
      fixtureCommand(
        { osuId: 992002, username: "Synthetic Player" },
        edition.slug,
        deletion(),
      ),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      fixtureCommand(actor, "other-test-cup", deletion()),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      fixtureCommand(actor, edition.slug, deletion(1)),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      fixtureCommand(actor, edition.slug, deletion(0, 1)),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db().select().from(fixtures)).toHaveLength(1);
  });
  it("makes exact concurrent retries idempotent and serializes edits against deletion", async () => {
    await Promise.all([
      fixtureCommand(actor, edition.slug, deletion()),
      fixtureCommand(actor, edition.slug, deletion()),
    ]);
    expect(
      await db()
        .select()
        .from(editionEvents)
        .where(eq(editionEvents.kind, "competition_fixture_delete")),
    ).toHaveLength(1);
    const recreated = await fixtureCommand(actor, edition.slug, {
      ...base,
      action: "create",
      roundId,
    });
    fixtureId = recreated.fixtures[0].id;
    const results = await Promise.allSettled([
      fixtureCommand(actor, edition.slug, {
        ...base,
        roundId,
        action: "edit",
        fixtureId,
        expectedVersion: 0,
        label: "Concurrent correction",
      }),
      fixtureCommand(actor, edition.slug, deletion()),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
  });
  it("rolls back deletion and history transfer if the audit write fails", async () => {
    await db().execute(
      sql`CREATE FUNCTION test_reject_delete_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.kind = 'competition_fixture_delete' THEN RAISE EXCEPTION 'Synthetic audit failure'; END IF; RETURN NEW; END $$; CREATE TRIGGER test_reject_delete_audit BEFORE INSERT ON edition_events FOR EACH ROW EXECUTE FUNCTION test_reject_delete_audit()`,
    );
    try {
      await expect(
        fixtureCommand(actor, edition.slug, deletion()),
      ).rejects.toThrow();
      expect(await db().select().from(fixtures)).toHaveLength(1);
      expect(await db().select().from(resultAuditEvents)).toHaveLength(1);
    } finally {
      await db().execute(
        sql`DROP TRIGGER test_reject_delete_audit ON edition_events; DROP FUNCTION test_reject_delete_audit()`,
      );
    }
  });
});
