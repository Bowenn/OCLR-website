import { updateTeams } from "../../src/lib/teams";
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
import { sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  editionState,
  registrations,
  users,
  editionEvents,
} from "../../src/db/schema";
import {
  captainSetup,
  updateCaptains,
  publicCaptains,
  captainAppointment,
} from "../../src/lib/captains";
import { withdrawRegistration } from "../../src/lib/registrations";
import { edition } from "../fixtures/edition";
const url = process.env.TEST_DATABASE_URL;
const staff = { osuId: 80001, username: "Synthetic Staff" };
const a = { osuId: 80002, username: "Synthetic Captain A" };
const b = { osuId: 80003, username: "Synthetic Captain B" };
const player = { osuId: 80004, username: "Synthetic Pool Player" };
describe.skipIf(!url)("captain setup, publication and eligibility", () => {
  let scratch: string;
  beforeAll(() => {
    if (!new URL(url!).pathname.includes("test"))
      throw new Error("Use a test database");
    scratch = mkdtempSync(join(tmpdir(), "oclr-captains-"));
    const path = join(scratch, "editions.json");
    writeFileSync(
      path,
      JSON.stringify([edition, { ...edition, slug: "second-test-cup" }]),
    );
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(staff.osuId));
    vi.stubEnv("OCLR_EDITIONS_FILE", path);
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await db().insert(users).values([staff, a, b, player]);
    await db().insert(editionState).values({ slug: edition.slug });
    for (const p of [a, b, player])
      await db().insert(registrations).values({
        userId: p.osuId,
        editionSlug: edition.slug,
        status: "accepted",
        rulesVersion: "test-v1",
        answers: {},
      });
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
    rmSync(scratch, { recursive: true, force: true });
  });
  const command = (version: number, value: Record<string, unknown>) => ({
    command: value,
    expectedVersion: version,
    reason: "Synthetic approved test change.",
    confirmed: true,
  });
  it("separates captain/staff/edition roles and excludes captains from the pool", async () => {
    const setup = await updateCaptains(
      staff,
      edition.slug,
      command(0, { action: "appoint", userId: a.osuId }),
    );
    expect(setup.pool.map((p) => p.userId)).not.toContain(a.osuId);
    expect(await captainAppointment(a.osuId, edition.slug)).not.toBeNull();
    expect(await captainAppointment(a.osuId, "second-test-cup")).toBeNull();
    await expect(
      updateCaptains(
        a,
        edition.slug,
        command(1, { action: "appoint", userId: b.osuId }),
      ),
    ).rejects.toMatchObject({ status: 403 });
    const r = (await db().select().from(registrations)).find(
      (r) => r.userId === a.osuId,
    )!;
    await expect(
      withdrawRegistration(a, r.id, { confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("allows one concurrent appointment and guards duplicate/cross-edition players", async () => {
    const results = await Promise.allSettled([
      updateCaptains(
        staff,
        edition.slug,
        command(0, { action: "appoint", userId: a.osuId }),
      ),
      updateCaptains(
        staff,
        edition.slug,
        command(0, { action: "appoint", userId: a.osuId }),
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    await expect(
      updateCaptains(
        staff,
        edition.slug,
        command(1, { action: "appoint", userId: a.osuId }),
      ),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateCaptains(
        staff,
        "second-test-cup",
        command(0, { action: "appoint", userId: b.osuId }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("validates complete order and freezes changes before draft", async () => {
    await updateCaptains(
      staff,
      edition.slug,
      command(0, { action: "appoint", userId: a.osuId }),
    );
    await updateCaptains(
      staff,
      edition.slug,
      command(1, { action: "appoint", userId: b.osuId }),
    );
    await expect(
      updateCaptains(
        staff,
        edition.slug,
        command(2, { action: "order", userIds: [a.osuId, a.osuId] }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    const ordered = await updateCaptains(
      staff,
      edition.slug,
      command(2, { action: "order", userIds: [b.osuId, a.osuId] }),
    );
    expect(ordered.captains.map((c) => c.userId)).toEqual([b.osuId, a.osuId]);
    await updateTeams(
      staff,
      edition.slug,
      command(3, {
        action: "configure",
        teams: [
          { captainId: a.osuId, name: "Synthetic A", capacity: null },
          { captainId: b.osuId, name: "Synthetic B", capacity: null },
        ],
      }),
    );
    await updateCaptains(staff, edition.slug, command(4, { action: "lock" }));
    await expect(
      updateCaptains(
        staff,
        edition.slug,
        command(5, { action: "revoke", userId: a.osuId }),
      ),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("publishes only deliberately released captain fields and audits replacement/availability", async () => {
    await updateCaptains(
      staff,
      edition.slug,
      command(0, { action: "appoint", userId: a.osuId }),
    );
    expect(await publicCaptains(edition.slug)).toEqual([]);
    await updateCaptains(
      staff,
      edition.slug,
      command(1, {
        action: "replace",
        previousUserId: a.osuId,
        userId: b.osuId,
      }),
    );
    await updateCaptains(
      staff,
      edition.slug,
      command(2, {
        action: "availability",
        userId: player.osuId,
        available: false,
      }),
    );
    expect(
      (await captainSetup(staff, edition.slug)).pool.map((p) => p.userId),
    ).toEqual([a.osuId]);
    await updateCaptains(
      staff,
      edition.slug,
      command(3, { action: "publish", published: true, poolPublished: false }),
    );
    expect(await publicCaptains(edition.slug)).toEqual([
      { osuId: b.osuId, username: b.username, position: 0 },
    ]);
    expect(await db().select().from(editionEvents)).toHaveLength(4);
  });
});
