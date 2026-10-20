import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  editionState,
  users,
  staffRoles,
  mappools,
  mappoolEntries,
  mappoolEvents,
  tournamentRounds,
} from "../../src/db/schema";
import {
  mappoolCommand,
  mappoolWorkspace,
  publicMappools,
} from "../../src/lib/mappools";
import { fetchBeatmap } from "../../src/lib/osu-beatmaps";
import { HttpError } from "../../src/lib/http";
import { edition } from "../fixtures/edition";
vi.mock("../../src/lib/osu-beatmaps", async (original) => ({
  ...(await original<typeof import("../../src/lib/osu-beatmaps")>()),
  fetchBeatmap: vi.fn(),
}));
const metadata = {
  setId: 1,
  artist: "Synthetic Artist",
  title: "Synthetic Song",
  difficulty: "Synthetic Difficulty",
  mapper: "Synthetic Mapper",
  stars: 4.5,
  bpm: 180,
  duration: 123,
};
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 190001, username: "Synthetic Admin" };
const mapper = { osuId: 190002, username: "Synthetic Mappooler" };
const referee = { osuId: 190003, username: "Synthetic Referee" };
const player = { osuId: 190004, username: "Synthetic Player" };
const confirm = { confirmed: true, reason: "Synthetic map rehearsal" };
describe.skipIf(!url)("edition mappool integrity and publication", () => {
  let scratch: string;
  beforeAll(() => {
    if (!new URL(url!).pathname.includes("test"))
      throw new Error("Use a test database");
    scratch = mkdtempSync(join(tmpdir(), "oclr-mappools-"));
    const path = join(scratch, "editions.json");
    writeFileSync(
      path,
      JSON.stringify([
        edition,
        { ...edition, slug: "other-test-cup" },
        { ...edition, slug: "private-test-cup", published: false },
      ]),
    );
    vi.stubEnv("OCLR_EDITIONS_FILE", path);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
  });
  beforeEach(async () => {
    vi.mocked(fetchBeatmap).mockReset().mockResolvedValue(metadata);
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await db().insert(users).values([admin, mapper, referee, player]);
    await db().insert(editionState).values({ slug: edition.slug });
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
    rmSync(scratch, { recursive: true, force: true });
  });
  async function create(
    stage = "group",
    slug = edition.slug,
    roundName = "Synthetic Round",
  ) {
    let data = await mappoolCommand(admin, slug, {
      ...confirm,
      action: "round_create",
      stage,
      name: roundName,
      position: 1,
    });
    data = await mappoolCommand(admin, slug, {
      ...confirm,
      action: "pool_create",
      roundId: data.rounds.find(
        (r) => r.name === roundName && r.stage === stage,
      )!.id,
      name: "Synthetic Pool",
    });
    return data.pools.find(
      (p) =>
        p.roundId ===
        data.rounds.find((r) => r.name === roundName && r.stage === stage)!.id,
    )!;
  }
  const add = (
    poolId: string,
    expectedVersion: number,
    position = 1,
    category = "NM",
    beatmap = "123",
  ) => ({
    ...confirm,
    action: "entry_save",
    poolId,
    expectedVersion,
    entryId: null,
    category,
    position,
    beatmap,
  });
  it("allows scoped Mappoolers and Admins while denying Referees, players and cross-edition access", async () => {
    expect((await mappoolWorkspace(mapper, edition.slug)).pools).toEqual([]);
    for (const user of [referee, player]) {
      await expect(mappoolWorkspace(user, edition.slug)).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        mappoolCommand(user, edition.slug, {}),
      ).rejects.toMatchObject({ status: 403 });
    }
    await expect(
      mappoolWorkspace(mapper, "other-test-cup"),
    ).rejects.toMatchObject({ status: 403 });
    await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "round_create",
      stage: "group",
      name: "Synthetic Round",
      position: 1,
    });
  });
  it("isolates group/knockout rounds and editions, rejecting cross-edition references", async () => {
    const group = await create();
    const knockout = await create("knockout");
    const other = await create("group", "other-test-cup");
    const data = await mappoolWorkspace(mapper, edition.slug);
    expect(data.rounds.map((r) => r.stage)).toEqual(["group", "knockout"]);
    expect(data.pools.map((p) => p.id).sort()).toEqual(
      [group.id, knockout.id].sort(),
    );
    await expect(
      mappoolCommand(mapper, edition.slug, {
        ...confirm,
        action: "pool_create",
        roundId: other.roundId,
        name: "Wrong scope",
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      mappoolCommand(mapper, edition.slug, add(other.id, 0)),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetchBeatmap).not.toHaveBeenCalled();
  });
  it("rejects duplicate slots in both commands and database constraints and commits one concurrent version", async () => {
    const pool = await create();
    const results = await Promise.allSettled([
      mappoolCommand(mapper, edition.slug, add(pool.id, 0)),
      mappoolCommand(mapper, edition.slug, add(pool.id, 0, 2)),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(results.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
    const [entry] = await db().select().from(mappoolEntries);
    await expect(
      mappoolCommand(mapper, edition.slug, add(pool.id, 1, entry.position)),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      db().insert(mappoolEntries).values({
        poolId: pool.id,
        category: entry.category,
        position: entry.position,
        beatmapId: 456,
        metadata,
      }),
    ).rejects.toThrow();
    expect(
      (await mappoolWorkspace(mapper, edition.slug)).pools[0].version,
    ).toBe(1);
  });
  it("supports explicit FM policies, replacement, ordering, removal and audited publication revisions", async () => {
    const pool = await create();
    await expect(
      mappoolCommand(mapper, edition.slug, add(pool.id, 0, 1, "FM")),
    ).rejects.toMatchObject({ status: 409 });
    let data = await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "pool_settings",
      poolId: pool.id,
      expectedVersion: 0,
      name: pool.name,
      fmMode: "force_mod",
      fmRestrictions: "Synthetic test policy only",
    });
    data = await mappoolCommand(
      mapper,
      edition.slug,
      add(pool.id, data.pools[0].version, 1, "FM"),
    );
    data = await mappoolCommand(
      mapper,
      edition.slug,
      add(pool.id, data.pools[0].version, 1),
    );
    data = await mappoolCommand(
      mapper,
      edition.slug,
      add(pool.id, data.pools[0].version, 2),
    );
    let nm = data.entries.filter((e) => e.category === "NM");
    const order = nm.map((e) => e.id).reverse();
    data = await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "reorder",
      poolId: pool.id,
      expectedVersion: data.pools[0].version,
      category: "NM",
      entryIds: order,
    });
    nm = data.entries.filter((e) => e.category === "NM");
    expect(nm.map((e) => e.id)).toEqual(order);
    data = await mappoolCommand(mapper, edition.slug, {
      ...add(pool.id, data.pools[0].version),
      entryId: nm[0].id,
      beatmap: "https://osu.ppy.sh/beatmapsets/1#osu/456",
    });
    expect(data.entries.find((e) => e.id === nm[0].id)?.beatmapId).toBe(456);
    data = await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "pool_publish",
      poolId: pool.id,
      expectedVersion: data.pools[0].version,
      published: true,
    });
    const [published] = await publicMappools(edition.slug, pool.id);
    expect(published.fmMode).toBe("force_mod");
    expect(published.fmRestrictions).toBe("Synthetic test policy only");
    await expect(
      mappoolCommand(mapper, edition.slug, {
        ...confirm,
        action: "entry_remove",
        poolId: pool.id,
        expectedVersion: data.pools[0].version,
        entryId: nm[0].id,
      }),
    ).rejects.toMatchObject({ status: 409 });
    data = await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "pool_publish",
      poolId: pool.id,
      expectedVersion: data.pools[0].version,
      published: false,
    });
    expect(await publicMappools(edition.slug, pool.id)).toEqual([]);
    const fm = data.entries.find((e) => e.category === "FM")!;
    data = await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "entry_remove",
      poolId: pool.id,
      expectedVersion: data.pools[0].version,
      entryId: fm.id,
    });
    await mappoolCommand(mapper, edition.slug, {
      ...confirm,
      action: "pool_settings",
      poolId: pool.id,
      expectedVersion: data.pools[0].version,
      name: pool.name,
      fmMode: null,
      fmRestrictions: "",
    });
    const events = await db()
      .select()
      .from(mappoolEvents)
      .where(eq(mappoolEvents.poolId, pool.id));
    expect(
      events.some((e) => e.action === "pool_publish" && e.before && e.after),
    ).toBe(true);
    expect(
      events.every(
        (e) => e.actorId === admin.osuId || e.actorId === mapper.osuId,
      ),
    ).toBe(true);
  });
  it("never returns draft pools or unpublished editions, including guessed direct IDs", async () => {
    const pool = await create();
    await mappoolCommand(mapper, edition.slug, add(pool.id, 0));
    expect(await publicMappools(edition.slug)).toEqual([]);
    expect(await publicMappools(edition.slug, pool.id)).toEqual([]);
    expect(await publicMappools("other-test-cup", pool.id)).toEqual([]);
    const privatePool = await create("group", "private-test-cup");
    await mappoolCommand(admin, "private-test-cup", add(privatePool.id, 0));
    await mappoolCommand(admin, "private-test-cup", {
      ...confirm,
      action: "pool_publish",
      poolId: privatePool.id,
      expectedVersion: 1,
      published: true,
    });
    expect(await publicMappools("private-test-cup", privatePool.id)).toEqual(
      [],
    );
    expect(await publicMappools(edition.slug, "not-a-uuid")).toEqual([]);
  });
  it("retains existing metadata and versions when official API refresh or replacement fails", async () => {
    const pool = await create();
    const data = await mappoolCommand(mapper, edition.slug, add(pool.id, 0));
    const entry = data.entries[0];
    await db()
      .update(mappoolEntries)
      .set({ metadataFetchedAt: new Date(0) })
      .where(eq(mappoolEntries.id, entry.id));
    vi.mocked(fetchBeatmap).mockRejectedValue(
      new HttpError(404, "Synthetic deleted map"),
    );
    await expect(
      mappoolCommand(mapper, edition.slug, {
        ...confirm,
        action: "entry_refresh",
        poolId: pool.id,
        expectedVersion: 1,
        entryId: entry.id,
      }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      mappoolCommand(mapper, edition.slug, {
        ...add(pool.id, 1),
        entryId: entry.id,
        beatmap: "789",
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(
      (await mappoolWorkspace(mapper, edition.slug)).entries[0],
    ).toMatchObject({ beatmapId: 123, metadata });
    expect(
      (await mappoolWorkspace(mapper, edition.slug)).pools[0].version,
    ).toBe(1);
  });
  it("protects completed-fixture pools and their round labels even after unpublishing", async () => {
    const pool = await create();
    const data = await mappoolCommand(mapper, edition.slug, add(pool.id, 0));
    await db()
      .update(mappools)
      .set({ lockedAt: new Date() })
      .where(eq(mappools.id, pool.id));
    await expect(
      mappoolCommand(mapper, edition.slug, {
        ...confirm,
        action: "entry_remove",
        poolId: pool.id,
        expectedVersion: 1,
        entryId: data.entries[0].id,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const [round] = await db()
      .select()
      .from(tournamentRounds)
      .where(eq(tournamentRounds.id, pool.roundId));
    await expect(
      mappoolCommand(mapper, edition.slug, {
        ...confirm,
        action: "round_edit",
        roundId: round.id,
        expectedVersion: round.version,
        name: "Changed",
        position: 2,
      }),
    ).rejects.toMatchObject({ status: 409 });
  });
});
