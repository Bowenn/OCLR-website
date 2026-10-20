import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import { sql, eq } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  users,
  staffRoles,
  staffRoleEvents,
  editionEvents,
  captains,
  registrations,
  registrationEvents,
  mappoolEvents,
} from "../../src/db/schema";
import { auditLog, safeAuditDetails, auditChanges } from "../../src/lib/audit";
import { assertTestDatabase } from "../database";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 390001, username: "Synthetic Audit Admin" };
const scoped = { osuId: 390002, username: "Synthetic Scoped Admin" };
const mapper = { osuId: 390003, username: "Synthetic Mappooler" };
const referee = { osuId: 390004, username: "Synthetic Referee" };
const captain = { osuId: 390005, username: "Synthetic Captain" };
describe.skipIf(!url)("central audit projections and scope", () => {
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([edition, { ...edition, slug: "other" }]);
    await db().insert(users).values([admin, scoped, mapper, referee, captain]);
    await db()
      .insert(staffRoles)
      .values([
        {
          userId: scoped.osuId,
          role: "admin",
          editionSlug: edition.slug,
          grantedBy: admin.osuId,
        },
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
  it("aggregates historical events, filters server-side, redacts private answers and leaves records intact", async () => {
    await db()
      .insert(editionEvents)
      .values([
        {
          editionSlug: edition.slug,
          actorId: admin.osuId,
          kind: "tournament_general",
          reason: "Historical note",
          detail: {
            before: { name: "Old" },
            after: { name: "New" },
            answers: { contact: "PRIVATE_ANSWER" },
          },
          createdAt: new Date("2026-01-02T12:00:00Z"),
        },
        {
          editionSlug: "other",
          actorId: admin.osuId,
          kind: "draft_pick",
          detail: { playerId: captain.osuId },
        },
      ]);
    const [registration] = await db()
      .insert(registrations)
      .values({
        editionSlug: edition.slug,
        userId: captain.osuId,
        answers: { private: "PRIVATE_ANSWER" },
        rulesVersion: null,
      })
      .returning();
    await db().insert(registrationEvents).values({
      registrationId: registration.id,
      actorId: admin.osuId,
      toStatus: "accepted",
    });
    await db()
      .insert(mappoolEvents)
      .values({
        editionSlug: edition.slug,
        actorId: mapper.osuId,
        action: "round_create",
        after: { id: "synthetic-round" },
      });
    const [grant] = await db()
      .select()
      .from(staffRoles)
      .where(eq(staffRoles.userId, mapper.osuId));
    await db().insert(staffRoleEvents).values({
      grantId: grant.id,
      actorId: admin.osuId,
      targetId: mapper.osuId,
      role: "mappooler",
      editionSlug: edition.slug,
      action: "grant",
    });
    const all = await auditLog(admin, {});
    expect(all.total).toBe(5);
    expect(all.rows.map((e) => e.module)).toEqual(
      expect.arrayContaining([
        "tournament",
        "registrations",
        "mappools",
        "staff",
        "draft",
      ]),
    );
    expect(JSON.stringify(all)).not.toContain("PRIVATE_ANSWER");
    const filtered = await auditLog(scoped, {
      edition: edition.slug,
      module: "tournament",
      actor: String(admin.osuId),
      action: "tournament_general",
      from: "2026-01-02",
      to: "2026-01-02",
    });
    expect(filtered.total).toBe(1);
    expect(filtered.rows[0]).toMatchObject({
      username: admin.username,
      actorId: admin.osuId,
      before: { name: "Old" },
      after: { name: "New" },
      details: { reason: "Historical note" },
    });
    expect(
      (await auditLog(admin, { from: "2026-01-03", module: "tournament" }))
        .total,
    ).toBe(0);
    expect((await db().select().from(editionEvents))[0].detail).toHaveProperty(
      "answers.contact",
      "PRIVATE_ANSWER",
    );
  });
  it("denies operators and foreign scopes, excludes global events, and honors revocation", async () => {
    await db()
      .insert(editionEvents)
      .values(
        [edition.slug, "other"].map((editionSlug) => ({
          editionSlug,
          actorId: admin.osuId,
          kind: "draft_pick",
          detail: { playerId: captain.osuId },
        })),
      );
    await db()
      .insert(captains)
      .values({
        editionSlug: edition.slug,
        userId: captain.osuId,
        position: 0,
      });
    const [globalGrant] = await db()
      .insert(staffRoles)
      .values({
        userId: mapper.osuId,
        role: "mappooler",
        editionSlug: null,
        grantedBy: admin.osuId,
      })
      .returning();
    await db()
      .insert(staffRoleEvents)
      .values({
        grantId: globalGrant.id,
        actorId: admin.osuId,
        targetId: mapper.osuId,
        role: "mappooler",
        editionSlug: null,
        action: "grant",
      });
    expect((await auditLog(admin, {})).total).toBe(3);
    for (const actor of [mapper, referee, captain])
      await expect(auditLog(actor, {})).rejects.toMatchObject({ status: 403 });
    expect((await auditLog(scoped, {})).rows.map((e) => e.edition)).toEqual([
      edition.slug,
    ]);
    await expect(auditLog(scoped, { edition: "other" })).rejects.toMatchObject({
      status: 403,
    });
    await db()
      .update(staffRoles)
      .set({ revokedAt: new Date() })
      .where(eq(staffRoles.userId, scoped.osuId));
    await expect(auditLog(scoped, {})).rejects.toMatchObject({ status: 403 });
  });
  it("paginates deterministically and rejects invalid filters", async () => {
    await db()
      .insert(editionEvents)
      .values(
        Array.from({ length: 31 }, (_, i) => ({
          editionSlug: edition.slug,
          actorId: admin.osuId,
          kind: "team_settings",
          detail: { after: { version: i } },
          createdAt: new Date("2026-01-02T12:00:00Z"),
        })),
      );
    const first = await auditLog(admin, {}),
      second = await auditLog(admin, { page: 2 });
    expect(first.total).toBe(31);
    expect(first.rows).toHaveLength(25);
    expect(second.rows).toHaveLength(6);
    expect(new Set([...first.rows, ...second.rows].map((e) => e.id)).size).toBe(
      31,
    );
    expect((await auditLog(admin, {})).rows).toEqual(first.rows);
    for (const input of [
      { page: 0 },
      { actor: "1 OR TRUE" },
      { module: "secret" },
      { from: "2026-02-01", to: "2026-01-01" },
    ])
      await expect(auditLog(admin, input)).rejects.toMatchObject({
        status: 400,
      });
  });
});
describe("bounded readable audit output", () => {
  it("redacts nested credentials and limits untrusted payloads", () => {
    const data = safeAuditDetails({
      access_token: "SECRET",
      nested: { answers: { q: "PRIVATE" }, name: "A".repeat(20000) },
      list: Array.from({ length: 100 }, () => ({ secret: "SECRET" })),
    });
    expect(JSON.stringify(data)).not.toContain("SECRET");
    expect(JSON.stringify(data)).not.toContain("PRIVATE");
    expect(JSON.stringify(data).length).toBeLessThan(20000);
    expect(
      auditChanges({ version: 1, name: "Old" }, { version: 2, name: "New" }),
    ).toEqual([
      { field: "version", before: "1", after: "2" },
      { field: "name", before: "Old", after: "New" },
    ]);
  });
  it("shows actual map replacements and creation fields, matching array records by stable ID", () => {
    expect(
      auditChanges(
        {
          entries: [
            { id: "map-a", beatmapId: 123 },
            { id: "map-b", beatmapId: 456 },
          ],
        },
        {
          entries: [
            { id: "map-b", beatmapId: 456 },
            { id: "map-a", beatmapId: 789 },
          ],
        },
      ),
    ).toEqual([
      { field: "entries / map-a / beatmapId", before: "123", after: "789" },
    ]);
    expect(
      auditChanges(null, { name: "Synthetic new tournament", version: 0 }),
    ).toContainEqual({
      field: "name",
      before: "—",
      after: "Synthetic new tournament",
    });
  });
});
