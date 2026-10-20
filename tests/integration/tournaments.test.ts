import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { assertTestDatabase } from "../database";
import { db, closeDb } from "../../src/db";
import {
  createTournament,
  tournamentCommand,
  tournamentForAdmin,
  tournamentList,
  readTournament,
  readTournaments,
} from "../../src/lib/tournaments";
import {
  users,
  staffRoles,
  editionState,
  editionRevisions,
  registrations,
} from "../../src/db/schema";
import { submitRegistration } from "../../src/lib/registrations";
import { getPublicEdition } from "../../src/lib/content";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 330001, username: "Synthetic Tournament Admin" };
const mapper = { osuId: 330002, username: "Synthetic Mappooler" };
const referee = { osuId: 330003, username: "Synthetic Referee" };
const player = { osuId: 330004, username: "Synthetic Player" };
const fields = {
  name: "Synthetic Season 12",
  season: "12",
  summary: "Synthetic tournament configuration only.",
  timeZone: "Asia/Taipei",
  branding: { logo: null, background: null, keyVisual: null },
};
const create = () =>
  createTournament(admin, { ...fields, slug: "s12", confirmed: true });
const change = (revision: number, action: string, data: object) =>
  tournamentCommand(admin, "s12", {
    expectedRevision: revision,
    confirmed: true,
    action,
    ...data,
  });
describe.skipIf(!url)("authoritative tournament edition storage", () => {
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
    vi.stubEnv("PRIVACY_CONTACT_EMAIL", "privacy@example.test");
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "Synthetic test policy.");
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await db().insert(users).values([admin, mapper, referee, player]);
    await seedEditions([
      edition,
      { ...edition, slug: "private-test-cup", published: false },
    ]);

    await db()
      .insert(staffRoles)
      .values([
        {
          userId: mapper.osuId,
          role: "mappooler",
          editionSlug: "test-cup",
          grantedBy: admin.osuId,
        },
        {
          userId: referee.osuId,
          role: "referee",
          editionSlug: "test-cup",
          grantedBy: admin.osuId,
        },
      ]);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it("filters unpublished configurations in the database and ignores legacy state without inventing content", async () => {
    await db().execute(
      sql`INSERT INTO edition_state (slug) VALUES ('legacy-unknown')`,
    );
    expect((await readTournaments()).map((r) => r.edition.slug).sort()).toEqual(
      ["private-test-cup", "test-cup"],
    );
    expect((await readTournaments(true)).map((r) => r.edition.slug)).toEqual([
      "test-cup",
    ]);
    expect(
      await readTournament("private-test-cup", db(), true),
    ).toBeUndefined();
    expect(await readTournament("legacy-unknown")).toBeUndefined();
    expect(await readTournament("test-cup")).toMatchObject({
      edition,
      revision: 0,
    });
  });
  it("limits tournament navigation to the assigned role without exposing other editions", async () => {
    const mapperRows = (await tournamentList(mapper)).rows;
    expect(mapperRows.map((row) => row.slug)).toEqual(["test-cup"]);
    expect(mapperRows[0].links.map((link) => link.label)).toEqual([
      "Dashboard",
      "Mappools",
    ]);
    const refereeRows = (await tournamentList(referee)).rows;
    expect(refereeRows[0].links.map((link) => link.label)).toEqual([
      "Dashboard",
      "Fixtures & results",
    ]);
    await expect(tournamentList(player)).rejects.toMatchObject({ status: 403 });
    expect(
      (await tournamentList(admin)).rows
        .find((row) => row.slug === "test-cup")
        ?.links.map((link) => link.label),
    ).toContain("Registrations");
  });
  it("rejects primary-key slug changes at the database boundary", async () => {
    await expect(
      db().execute(
        sql`UPDATE edition_state SET slug = 'renamed' WHERE slug = 'test-cup'`,
      ),
    ).rejects.toThrow();
    expect((await readTournament("test-cup"))?.edition.name).toBe(edition.name);
  });
  it("creates only an unpublished configuration, audits its actor and rejects duplicate or mutable slugs", async () => {
    const saved = await create();
    expect(saved.edition).toMatchObject({
      slug: "s12",
      published: false,
      rules: null,
      eligibility: null,
      registration: null,
      schedule: [],
    });
    expect(saved.events[0]).toMatchObject({
      actorId: admin.osuId,
      reason: null,
      kind: "tournament_create",
      detail: { before: null, after: { revision: 0 } },
    });
    expect(await getPublicEdition("s12")).toBeUndefined();
    await expect(create()).rejects.toMatchObject({ status: 409 });
    await expect(
      change(0, "general", { ...fields, status: "upcoming", slug: "renamed" }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db().select().from(registrations)).toEqual([]);
  });
  it("enforces Admin scopes, current roles and a single winning configuration revision", async () => {
    await create();
    for (const actor of [mapper, referee, player]) {
      await expect(
        createTournament(actor, {
          ...fields,
          slug: "unowned",
          confirmed: true,
        }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(tournamentForAdmin(actor, "s12")).rejects.toMatchObject({
        status: 403,
      });
      await expect(
        tournamentCommand(actor, "s12", {
          action: "publication",
          published: true,
          expectedRevision: 0,
          confirmed: true,
          contentApproved: true,
        }),
      ).rejects.toMatchObject({ status: 403 });
    }
    expect((await tournamentList(mapper)).rows.map((r) => r.slug)).toEqual([
      "test-cup",
    ]);
    const writes = await Promise.allSettled(
      ["First", "Second"].map((name) =>
        change(0, "general", { ...fields, name, status: "upcoming" }),
      ),
    );
    expect(writes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(writes.find((r) => r.status === "rejected")).toMatchObject({
      reason: { status: 409 },
    });
    expect((await tournamentForAdmin(admin, "s12")).events).toHaveLength(2);
    await db().insert(staffRoles).values({
      userId: player.osuId,
      role: "admin",
      editionSlug: "s12",
      grantedBy: admin.osuId,
    });
    await expect(tournamentForAdmin(player, "s12")).resolves.toMatchObject({
      revision: 1,
    });
    await expect(tournamentForAdmin(player, "test-cup")).rejects.toMatchObject({
      status: 403,
    });
    await db()
      .update(staffRoles)
      .set({ revokedAt: new Date() })
      .where(eq(staffRoles.userId, player.osuId));
    await expect(tournamentForAdmin(player, "s12")).rejects.toMatchObject({
      status: 403,
    });
  });
  it("separates publication from registration and preserves the application rules/question snapshot", async () => {
    let current = await create();
    current = await change(current.revision, "rules", {
      rules: {
        version: "s12-v1",
        sections: [
          { heading: "Synthetic rules", body: "Approved synthetic policy." },
        ],
      },
      eligibility: "Synthetic eligibility disclosure.",
    });
    const registration = {
      ...edition.registration!,
      enabled: false,
      questions: [
        {
          id: "answer",
          label: "Original question",
          required: true,
          maxLength: 10,
        },
      ],
    };
    current = await change(current.revision, "registration", { registration });
    current = await change(current.revision, "publication", {
      published: true,
      contentApproved: true,
    });
    expect(current.edition.registration?.enabled).toBe(false);
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "");
    await expect(
      change(current.revision, "registration", {
        registration: { ...registration, enabled: true },
      }),
    ).rejects.toMatchObject({ status: 409 });
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "Synthetic test policy.");
    current = await change(current.revision, "registration", {
      registration: { ...registration, enabled: true },
    });
    const saved = await submitRegistration(player, "s12", {
      rulesAcknowledged: true,
      configurationVersion: current.revision,
      eligibilityAcknowledged: true,
      rulesVersion: "s12-v1",
      answers: { answer: "accepted" },
    });
    expect(saved.configurationVersion).toBe(current.revision);
    const rules = {
      ...current.edition.rules!,
      sections: [
        { heading: "Revised rules", body: "New approved synthetic policy." },
      ],
    };
    await expect(
      change(current.revision, "rules", {
        rules: { ...rules, version: "s12-v2" },
        eligibility: current.edition.eligibility,
        existingApplicationsPolicy: "retain_existing",
      }),
    ).rejects.toMatchObject({ status: 409 });
    current = await change(current.revision, "registration", { registration });
    await expect(
      change(current.revision, "rules", {
        rules,
        eligibility: current.edition.eligibility,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      change(current.revision, "rules", {
        rules: { ...rules, version: "s12-v2" },
        eligibility: current.edition.eligibility,
      }),
    ).rejects.toMatchObject({ status: 400 });
    current = await change(current.revision, "rules", {
      rules: { ...rules, version: "s12-v2" },
      eligibility: current.edition.eligibility,
      existingApplicationsPolicy: "retain_existing",
    });
    current = await change(current.revision, "registration", {
      registration: {
        ...registration,
        questions: [
          { ...registration.questions[0], label: "Revised question" },
        ],
      },
      existingApplicationsPolicy: "retain_existing",
    });
    current = await change(current.revision, "registration", {
      registration: { ...registration, questions: [] },
      existingApplicationsPolicy: "retain_existing",
    });
    await expect(
      change(current.revision, "registration", {
        registration,
        existingApplicationsPolicy: "retain_existing",
      }),
    ).rejects.toMatchObject({ status: 409 });
    const [snapshot] = await db()
      .select()
      .from(editionRevisions)
      .where(
        and(
          eq(editionRevisions.editionSlug, "s12"),
          eq(editionRevisions.version, saved.configurationVersion!),
        ),
      );
    expect(snapshot.configuration.rules?.version).toBe("s12-v1");
    expect(snapshot.configuration.registration?.questions[0].label).toBe(
      "Original question",
    );
    expect((await db().select().from(registrations))[0]).toMatchObject({
      rulesVersion: "s12-v1",
      answers: { answer: "accepted" },
    });
    current = await change(current.revision, "publication", {
      published: false,
      contentApproved: true,
    });
    expect(await getPublicEdition("s12")).toBeUndefined();
    expect(current.edition.registration?.enabled).toBe(false);
  });
  it("rejects invalid dates, time zones, forged audit data and locked competition configuration", async () => {
    await expect(
      createTournament(admin, {
        ...fields,
        slug: "invalid",
        timeZone: "invalid",
        confirmed: true,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await create();
    await expect(
      change(0, "registration", {
        registration: {
          ...edition.registration!,
          closesAt: "2020-01-01T00:00:00Z",
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      change(0, "general", {
        ...fields,
        status: "upcoming",
        actorId: player.osuId,
      }),
    ).rejects.toMatchObject({ status: 400 });
    await db()
      .update(editionState)
      .set({ lockedAt: new Date(), setupVersion: 9 })
      .where(eq(editionState.slug, "s12"));
    await expect(
      change(0, "schedule", {
        schedule: [{ label: "Synthetic milestone", at: null }],
      }),
    ).rejects.toMatchObject({ status: 409 });
    const saved = await change(0, "general", {
      ...fields,
      name: "Completed synthetic edition",
      status: "completed",
    });
    expect(saved.events).toHaveLength(2);
    expect(
      (
        await db()
          .select()
          .from(editionState)
          .where(eq(editionState.slug, "s12"))
      )[0].setupVersion,
    ).toBe(9);
  });
  it("rolls back configuration and snapshots if automatic audit persistence fails", async () => {
    await db().execute(
      sql`CREATE FUNCTION oclr_test_reject_edition_event() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit failure'; END $$`,
    );
    await db().execute(
      sql`CREATE TRIGGER oclr_test_reject_edition_event BEFORE INSERT ON edition_events FOR EACH ROW EXECUTE FUNCTION oclr_test_reject_edition_event()`,
    );
    try {
      await expect(create()).rejects.toThrow();
      expect(await readTournament("s12")).toBeUndefined();
      expect(
        await db()
          .select()
          .from(editionRevisions)
          .where(eq(editionRevisions.editionSlug, "s12")),
      ).toEqual([]);
    } finally {
      await db().execute(
        sql`DROP TRIGGER oclr_test_reject_edition_event ON edition_events`,
      );
      await db().execute(sql`DROP FUNCTION oclr_test_reject_edition_event()`);
    }
  });
  it("does not manufacture configuration changes or audit events for identical saves", async () => {
    await create();
    const same = await change(0, "general", { ...fields, status: "upcoming" });
    expect(same.revision).toBe(0);
    expect(same.events).toHaveLength(1);
    expect(
      (
        await change(0, "publication", {
          published: false,
          contentApproved: true,
        })
      ).revision,
    ).toBe(0);
  });
  it("serializes application submission against configuration edits and never acknowledges the wrong snapshot", async () => {
    const submitted = {
      rulesAcknowledged: true,
      eligibilityAcknowledged: true,
      rulesVersion: edition.rules!.version,
      configurationVersion: 0,
      answers: {},
    };
    const results = await Promise.allSettled([
      submitRegistration(player, "test-cup", submitted),
      tournamentCommand(admin, "test-cup", {
        expectedRevision: 0,
        confirmed: true,
        action: "general",
        name: "Changed synthetic name",
        season: null,
        summary: edition.summary,
        timeZone: edition.timeZone,
        branding: edition.branding,
        status: edition.status,
      }),
    ]);
    expect(results[1].status).toBe("fulfilled");
    const records = await db().select().from(registrations);
    if (results[0].status === "fulfilled") {
      expect(records).toHaveLength(1);
      expect(records[0]).toMatchObject({
        configurationVersion: 0,
        rulesVersion: "test-v1",
      });
    } else {
      expect(results[0].reason).toMatchObject({ status: 409 });
      expect(records).toEqual([]);
    }
    await expect(
      submitRegistration(player, "test-cup", submitted),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("pauses registration on completion, so restoring Upcoming cannot reopen it implicitly", async () => {
    const command = {
      expectedRevision: 0,
      confirmed: true,
      action: "general",
      name: edition.name,
      season: edition.season,
      summary: edition.summary,
      timeZone: edition.timeZone,
      branding: edition.branding,
      status: "completed",
    };
    const complete = await tournamentCommand(admin, "test-cup", command);
    expect(complete.edition.registration?.enabled).toBe(false);
    expect(
      (await tournamentList(admin)).rows.find((row) => row.slug === "test-cup")
        ?.registrationState,
    ).toBe("closed");
    const restored = await tournamentCommand(admin, "test-cup", {
      ...command,
      expectedRevision: complete.revision,
      status: "upcoming",
    });
    expect(restored.edition.registration?.enabled).toBe(false);
  });
});
