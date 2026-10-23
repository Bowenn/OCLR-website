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
  editionEvents,
  registrations,
  teams,
} from "../../src/db/schema";
import { tournamentCommand, readTournament } from "../../src/lib/tournaments";
import { getPublicEdition } from "../../src/lib/content";
import { assertOperationalEdition } from "../../src/lib/archive-guard";
import { mappoolCommand } from "../../src/lib/mappools";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { historicalArchive } from "../fixtures/historical-archive";
import { assertTestDatabase } from "../database";
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 390001, username: "Archive Admin" };
const scoped = { osuId: 390002, username: "Other edition Admin" };
const slug = "history-test";
const command = (revision: number, archive = historicalArchive) => ({
  action: "archive",
  expectedRevision: revision,
  confirmed: true,
  archive,
});
describe.skipIf(!url)("historical archive transactions", () => {
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await db().insert(users).values([admin, scoped]);
    await seedEditions([
      {
        ...edition,
        slug,
        status: "completed",
        registration: null,
        published: false,
      },
      { ...edition, slug: "other" },
    ]);
    await db().insert(staffRoles).values({
      userId: scoped.osuId,
      role: "admin",
      editionSlug: "other",
      grantedBy: admin.osuId,
    });
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it("imports privately, keeps source identities out of accounts, and publishes separately", async () => {
    await tournamentCommand(admin, slug, command(0));
    expect((await readTournament(slug))?.edition.archive).toEqual(
      historicalArchive,
    );
    expect(await getPublicEdition(slug)).toBeUndefined();
    expect(await db().select().from(users)).toHaveLength(2);
    expect(await db().select().from(registrations)).toHaveLength(0);
    expect(await db().select().from(teams)).toHaveLength(0);
    const events = await db()
      .select()
      .from(editionEvents)
      .where(eq(editionEvents.editionSlug, slug));
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("tournament_archive");
    await tournamentCommand(admin, slug, {
      action: "publication",
      expectedRevision: 1,
      confirmed: true,
      published: true,
    });
    expect((await getPublicEdition(slug))?.archive).toEqual(historicalArchive);
    await expect(
      tournamentCommand(admin, slug, command(2)),
    ).rejects.toMatchObject({ status: 409 });
    await tournamentCommand(admin, slug, {
      action: "publication",
      expectedRevision: 2,
      confirmed: true,
      published: false,
    });
    expect(await getPublicEdition(slug)).toBeUndefined();
    await tournamentCommand(admin, slug, command(3));
    expect((await readTournament(slug))?.revision).toBe(3); // Identical import is a no-op.
  });
  it("enforces edition scope, revision, source matching and complete rollback", async () => {
    await expect(
      tournamentCommand(scoped, slug, command(0)),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      tournamentCommand(
        admin,
        slug,
        command(0, { ...historicalArchive, editionSlug: "other" }),
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect((await readTournament(slug))?.revision).toBe(0);
    expect(await db().select().from(editionEvents)).toHaveLength(0);
    const outcomes = await Promise.allSettled([
      tournamentCommand(admin, slug, command(0)),
      tournamentCommand(admin, slug, command(0)),
    ]);
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await db().select().from(editionEvents)).toHaveLength(1);
  });
  it("prevents changing archive editions back into active competitions", async () => {
    await tournamentCommand(admin, slug, command(0));
    await expect(assertOperationalEdition(slug, db())).rejects.toMatchObject({
      status: 409,
    });
    await expect(
      tournamentCommand(admin, slug, {
        action: "registration",
        expectedRevision: 1,
        confirmed: true,
        registration: edition.registration,
      }),
    ).rejects.toMatchObject({ status: 409 });
    const { name, season, summary, timeZone, branding } = edition;
    await expect(
      tournamentCommand(admin, slug, {
        action: "general",
        expectedRevision: 1,
        confirmed: true,
        name,
        season,
        summary,
        timeZone,
        branding,
        status: "upcoming",
      }),
    ).rejects.toMatchObject({ status: 400 });
  });
  it("blocks operational pool creation after archive import", async () => {
    await tournamentCommand(admin, slug, command(0));
    await expect(
      mappoolCommand(admin, slug, {
        action: "round_create",
        stage: "group",
        name: "New round",
        position: 1,
        confirmed: true,
      }),
    ).rejects.toMatchObject({
      status: 409,
      message: "Historical archives are edited through the archive importer.",
    });
  });
  it("does not replace an edition that already has operational rounds", async () => {
    await mappoolCommand(admin, slug, {
      action: "round_create",
      stage: "group",
      name: "Existing round",
      position: 1,
      confirmed: true,
    });
    await expect(
      tournamentCommand(admin, slug, command(0)),
    ).rejects.toMatchObject({
      status: 409,
      message:
        "This tournament already has live competition data. Use a separate historical edition.",
    });
    expect((await readTournament(slug))?.edition.archive).toBeUndefined();
    expect((await readTournament(slug))?.revision).toBe(0);
  });
});
