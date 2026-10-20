let fixtureEditions: unknown[];
import { seedEditions } from "../fixtures/editions";
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
import { captains, teams } from "../../src/db/schema";
import { publicPlayers } from "../../src/lib/players";
import { edition } from "../fixtures/edition";
import { seedPublicDirectory } from "../fixtures/players";
const url = process.env.TEST_DATABASE_URL;
const base = 230001;
describe.skipIf(!url)("public player directory publication boundaries", () => {
  let fixture: Awaited<ReturnType<typeof seedPublicDirectory>>;
  beforeAll(() => {
    assertTestDatabase(url);
    fixtureEditions = [
      edition,
      { ...edition, slug: "private-test-cup", published: false },
    ];
    vi.stubEnv("DATABASE_URL", url!);
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions(fixtureEditions);
    fixture = await seedPublicDirectory(base);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it("exposes only published captain identities and finalized published roster members", async () => {
    const data = await publicPlayers({});
    expect(data.rows.map((p) => p.osuId).sort()).toEqual([
      fixture.captainId,
      fixture.memberId,
    ]);
    expect(data.rows.find((p) => p.osuId === fixture.captainId)).toMatchObject({
      captain: true,
      team: { id: fixture.teamId },
      participation: "finalized_roster",
    });
    expect(JSON.stringify(data)).not.toMatch(
      /PRIVATE_CONTACT|INTERNAL_REASON|answers|registrationId|statusReason/,
    );
    expect(data.rows.filter((p) => p.osuId === fixture.captainId)).toHaveLength(
      1,
    );
  });
  it("hides roster members when any required publication/finalization flag is removed", async () => {
    for (const change of [
      { rosterPublished: false },
      { finalizedAt: null },
      { identityPublished: false },
      { archivedAt: new Date() },
    ]) {
      await db()
        .update(teams)
        .set({
          rosterPublished: true,
          finalizedAt: new Date(),
          identityPublished: true,
          archivedAt: null,
          ...change,
        })
        .where(eq(teams.id, fixture.teamId));
      const data = await publicPlayers({});
      expect(data.rows.map((p) => p.osuId)).toEqual([fixture.captainId]);
      expect(data.rows[0].participation).toBe("captain");
      if ("identityPublished" in change || "archivedAt" in change)
        expect(data.rows[0].team).toBeNull();
    }
  });
  it("honors withdrawn captain publication and unpublished editions at query time", async () => {
    await db()
      .update(captains)
      .set({ published: false })
      .where(eq(captains.userId, fixture.captainId));
    expect((await publicPlayers({})).rows).toEqual([]);
    await db()
      .update(captains)
      .set({ published: true })
      .where(eq(captains.userId, fixture.captainId));
    await db().insert(captains).values({
      editionSlug: "private-test-cup",
      userId: fixture.unpublishedCaptainId,
      position: 1,
      published: true,
    });
    expect((await publicPlayers({ edition: "private-test-cup" })).rows).toEqual(
      [],
    );
    expect(
      (await publicPlayers({})).rows.some(
        (p) => p.editionSlug === "private-test-cup",
      ),
    ).toBe(false);
  });
  it("supports bounded search/edition/pagination without exposing guessed private identities", async () => {
    expect(
      (await publicPlayers({ q: String(fixture.memberId) })).rows.map(
        (p) => p.osuId,
      ),
    ).toEqual([fixture.memberId]);
    expect(
      (
        await publicPlayers({
          q: `synthetic directory ${base} member`,
          edition: "test-cup",
        })
      ).total,
    ).toBe(1);
    expect((await publicPlayers({ q: String(fixture.privateId) })).total).toBe(
      0,
    );
    expect(
      (await publicPlayers({ q: String(fixture.unpublishedCaptainId) })).total,
    ).toBe(0);
    expect((await publicPlayers({ page: 2 })).rows).toEqual([]);
    for (const input of [
      { q: "x".repeat(101) },
      { page: 0 },
      { userId: fixture.privateId },
    ])
      await expect(publicPlayers(input)).rejects.toMatchObject({ status: 400 });
  });
});
