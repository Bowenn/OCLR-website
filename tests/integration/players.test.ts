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
import { captains, registrations, teams, users } from "../../src/db/schema";
import { publicPlayers, publicParticipantCount } from "../../src/lib/players";
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
  it("returns every accepted identity beyond the former 24-player page", async () => {
    const ids = Array.from({ length: 53 }, (_, i) => base + 100 + i);
    await db()
      .insert(users)
      .values(
        ids.map((osuId) => ({ osuId, username: `Complete list ${osuId}` })),
      );
    await db()
      .insert(registrations)
      .values(
        ids.map((userId) => ({
          userId,
          editionSlug: "test-cup",
          status: "accepted" as const,
          answers: { private: "PRIVATE_CONTACT" },
        })),
      );
    for (const page of [1, 2, 999]) {
      const result = await publicPlayers({ edition: "test-cup", page });
      expect(result.rows).toHaveLength(56);
      expect(result.total).toBe(56);
      expect(new Set(result.rows.map((p) => p.osuId)).size).toBe(56);
      expect(result.rows.some((p) => p.osuId === fixture.privateId)).toBe(
        false,
      );
    }
    expect(
      (await publicPlayers({ edition: "test-cup", q: "Complete list" })).rows,
    ).toHaveLength(53);
  });
  it("counts only accepted participants in a currently published edition", async () => {
    expect(await publicParticipantCount("test-cup")).toBe(3);
    expect(await publicParticipantCount("private-test-cup")).toBeNull();
    expect(await publicParticipantCount("missing-cup")).toBeNull();
    for (const status of [
      "pending",
      "deferred",
      "rejected",
      "withdrawn",
    ] as const) {
      await db()
        .update(registrations)
        .set({ status })
        .where(eq(registrations.userId, fixture.memberId));
      expect(await publicParticipantCount("test-cup")).toBe(2);
    }
    await seedEditions([{ ...edition, slug: "empty-public-cup" }]);
    expect(await publicParticipantCount("empty-public-cup")).toBe(0);
    await seedEditions([{ ...edition, published: false }]);
    expect(await publicParticipantCount("test-cup")).toBeNull();
  });
  it("exposes every accepted player, independently of role/roster release", async () => {
    const data = await publicPlayers({ edition: "test-cup" });
    expect(data.rows.map((p) => p.osuId).sort()).toEqual([
      fixture.captainId,
      fixture.memberId,
      fixture.unpublishedCaptainId,
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
      const data = await publicPlayers({ edition: "test-cup" });
      expect(data.rows).toHaveLength(3);
      expect(data.rows.find((p) => p.osuId === fixture.memberId)).toMatchObject(
        { participation: "accepted", captain: false, team: null },
      );
      expect(
        data.rows.find((p) => p.osuId === fixture.captainId)?.participation,
      ).toBe("captain");
      if ("identityPublished" in change || "archivedAt" in change)
        expect(
          data.rows.find((p) => p.osuId === fixture.captainId)?.team,
        ).toBeNull();
    }
  });
  it("honors withdrawn captain publication and unpublished editions at query time", async () => {
    await db()
      .update(captains)
      .set({ published: false })
      .where(eq(captains.userId, fixture.captainId));
    const data = await publicPlayers({ edition: "test-cup" });
    expect(data.rows).toHaveLength(3);
    expect(data.rows.every((p) => !p.captain && !p.team)).toBe(true);
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
      (await publicPlayers({ edition: "test-cup" })).rows.some(
        (p) => p.editionSlug === "private-test-cup",
      ),
    ).toBe(false);
  });
  it("isolates editions and removes nonaccepted identities immediately without leaking private fields", async () => {
    await seedEditions(
      [edition, { ...edition, slug: "second-cup", name: "Second cup" }],
      false,
    );
    await db().insert(registrations).values({
      userId: fixture.privateId,
      editionSlug: "second-cup",
      status: "accepted",
      rulesVersion: null,
      answers: {},
    });
    expect(
      (
        await publicPlayers({
          edition: "test-cup",
          q: String(fixture.privateId),
        })
      ).rows,
    ).toEqual([]);
    expect(
      (await publicPlayers({ edition: "second-cup" })).rows.map((p) => p.osuId),
    ).toEqual([fixture.privateId]);
    for (const status of [
      "pending",
      "deferred",
      "rejected",
      "withdrawn",
    ] as const) {
      await db()
        .update(registrations)
        .set({ status })
        .where(eq(registrations.userId, fixture.memberId));
      expect(
        (
          await publicPlayers({
            edition: "test-cup",
            q: String(fixture.memberId),
          })
        ).rows,
      ).toEqual([]);
    }
  });
  it("supports bounded search and legacy page links without exposing guessed private identities", async () => {
    expect(
      (
        await publicPlayers({
          edition: "test-cup",
          q: String(fixture.memberId),
        })
      ).rows.map((p) => p.osuId),
    ).toEqual([fixture.memberId]);
    expect(
      (
        await publicPlayers({
          q: `synthetic directory ${base} member`,
          edition: "test-cup",
        })
      ).total,
    ).toBe(1);
    expect(
      (
        await publicPlayers({
          edition: "test-cup",
          q: String(fixture.privateId),
        })
      ).total,
    ).toBe(0);
    expect(
      (
        await publicPlayers({
          edition: "test-cup",
          q: String(fixture.unpublishedCaptainId),
        })
      ).rows,
    ).toMatchObject([
      { captain: false, team: null, participation: "accepted" },
    ]);
    expect(
      (await publicPlayers({ edition: "test-cup", page: 2 })).rows,
    ).toEqual((await publicPlayers({ edition: "test-cup" })).rows);
    for (const input of [
      { q: "x".repeat(101) },
      { page: 0 },
      { userId: fixture.privateId },
      {},
    ])
      await expect(publicPlayers(input)).rejects.toMatchObject({ status: 400 });
  });
});
