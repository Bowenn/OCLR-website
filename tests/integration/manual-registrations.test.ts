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
  users,
  registrations,
  registrationEvents,
  userProfileCache,
  editionState,
  draftSessions,
  staffRoles,
  sessions,
} from "../../src/db/schema";
import {
  addManualRegistration,
  previewManualRegistration,
} from "../../src/lib/manual-registrations";
import {
  ownRegistrations,
  submitRegistration,
  withdrawRegistration,
} from "../../src/lib/registrations";
import { playerApplications } from "../../src/lib/dashboard";
import { publicPlayer } from "../../src/lib/players";
import { auditLog } from "../../src/lib/audit";
import { createSession } from "../../src/lib/auth/sessions";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
import { applicationQuestions } from "../fixtures/application-questions";
import { profileResponse } from "../fixtures/osu-profile";
import { assertTestDatabase } from "../database";
vi.mock("../../src/lib/osu-api", () => ({ osuApi: vi.fn() }));
import { osuApi } from "../../src/lib/osu-api";
const provider = vi.mocked(osuApi);
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 979999, username: "Synthetic manual Admin" };
const playerId = profileResponse.id;
const command = {
  input: String(playerId),
  expectedRevision: 0,
  status: "pending",
  confirmed: true,
};
describe.skipIf(!url)("staff-assisted registration integrity", () => {
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
    vi.stubEnv("PRIVACY_CONTACT_OSU_ID", String(admin.osuId));
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "Synthetic policy.");
  });
  beforeEach(async () => {
    await db().execute(
      sql`TRUNCATE edition_state, users, user_profile_cache CASCADE`,
    );
    await seedEditions([edition, { ...edition, slug: "other-test-cup" }]);
    await db().insert(users).values(admin);
    provider.mockReset().mockResolvedValue(profileResponse);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it("previews an official identity without creating users, registrations or sessions", async () => {
    const preview = await previewManualRegistration(admin, edition.slug, {
      input: `https://osu.ppy.sh/users/${playerId}/osu`,
    });
    expect(preview.profile.username).toBe(profileResponse.username);
    expect(preview.edition).toMatchObject({
      slug: edition.slug,
      revision: 0,
      outsideWindow: false,
    });
    expect(provider).toHaveBeenCalledWith(`/users/${playerId}/osu?key=id`);
    expect(await db().select().from(registrations)).toEqual([]);
    expect(
      await db().select().from(users).where(eq(users.osuId, playerId)),
    ).toEqual([]);
    expect(await db().select().from(sessions)).toEqual([]);
  });
  it("adds Pending with truthful provenance, revision and no player acknowledgments", async () => {
    await seedEditions([
      {
        ...edition,
        registration: {
          ...edition.registration,
          questions: applicationQuestions,
        },
      },
    ]);
    const row = await addManualRegistration(admin, edition.slug, command);
    expect(row).toMatchObject({
      userId: playerId,
      source: "staff",
      status: "pending",
      configurationVersion: 0,
      rulesVersion: null,
      eligibilityAcknowledged: null,
      answers: {},
    });
    expect(await publicPlayer(playerId, edition.slug)).toEqual([]);
    const [event] = await db().select().from(registrationEvents);
    expect(event).toMatchObject({
      registrationId: row.id,
      actorId: admin.osuId,
      fromStatus: null,
      toStatus: "pending",
      reason: null,
    });
    const log = await auditLog(admin, {
      edition: edition.slug,
      module: "registrations",
    });
    expect(JSON.stringify(log)).toContain('"registrationSource":"staff"');
    expect(await db().select().from(sessions)).toHaveLength(0);
  });
  it("requires explicit Accepted publication approval and exposes identity only in the chosen edition", async () => {
    await expect(
      addManualRegistration(admin, edition.slug, {
        ...command,
        status: "accepted",
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(await db().select().from(registrations)).toEqual([]);
    await addManualRegistration(admin, edition.slug, {
      ...command,
      status: "accepted",
      publicationAcknowledged: true,
    });
    expect(await publicPlayer(playerId, edition.slug)).toHaveLength(1);
    expect(await publicPlayer(playerId, "other-test-cup")).toHaveLength(0);
    expect(
      (await db().execute(sql`SELECT COUNT(*)::int AS n FROM captains`)).rows[0]
        .n,
    ).toBe(0);
    expect(
      (await db().execute(sql`SELECT COUNT(*)::int AS n FROM memberships`))
        .rows[0].n,
    ).toBe(0);
  });
  it("uses stable identity ownership on real session creation and preserves normal withdrawal", async () => {
    const row = await addManualRegistration(admin, edition.slug, command);
    await createSession(playerId);
    expect(await ownRegistrations(playerId)).toHaveLength(1);
    expect((await playerApplications(playerId))[0].registration.source).toBe(
      "staff",
    );
    await expect(
      submitRegistration(
        { osuId: playerId, username: profileResponse.username },
        edition.slug,
        {
          configurationVersion: 0,
          rulesAcknowledged: true,
          eligibilityAcknowledged: true,
          rulesVersion: "test-v1",
        },
      ),
    ).rejects.toMatchObject({ status: 409 });
    await withdrawRegistration(
      { osuId: playerId, username: profileResponse.username },
      row.id,
      { confirmed: true },
    );
    expect((await ownRegistrations(playerId))[0].status).toBe("withdrawn");
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("commits one concurrent/retried entry and one audit event without duplicate users", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () =>
        addManualRegistration(admin, edition.slug, command),
      ),
    );
    expect(results.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(
      results
        .filter((x) => x.status === "rejected")
        .every((x) => x.status === "rejected" && x.reason.status === 409),
    ).toBe(true);
    expect(await db().select().from(registrationEvents)).toHaveLength(1);
    expect(
      await db().select().from(users).where(eq(users.osuId, playerId)),
    ).toHaveLength(1);
    await db().update(registrations).set({ status: "rejected" });
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 409 });
  });
  it("requires a deliberate late-entry exception without reopening public registration", async () => {
    const closed = {
      ...edition,
      registration: {
        ...edition.registration!,
        closesAt: "2025-02-01T00:00:00Z",
      },
    };
    await seedEditions([closed]);
    expect(
      (
        await previewManualRegistration(admin, edition.slug, {
          input: command.input,
        })
      ).edition.outsideWindow,
    ).toBe(true);
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      addManualRegistration(admin, edition.slug, {
        ...command,
        overrideWindow: true,
        exceptionReason: " ",
      }),
    ).rejects.toMatchObject({ status: 409 });
    await addManualRegistration(admin, edition.slug, {
      ...command,
      overrideWindow: true,
      exceptionReason: "Organizer-approved late entry",
    });
    expect((await db().select().from(registrationEvents))[0].reason).toBe(
      "Organizer-approved late entry",
    );
    expect(
      (
        await db()
          .select()
          .from(editionState)
          .where(eq(editionState.slug, edition.slug))
      )[0].configuration?.registration?.closesAt,
    ).toBe(closed.registration.closesAt);
    expect(await publicPlayer(playerId, edition.slug)).toEqual([]);
  });
  it("rejects locked, completed, active/finalized drafts and stale revisions", async () => {
    await expect(
      addManualRegistration(admin, edition.slug, {
        ...command,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ status: 409 });
    await db()
      .update(editionState)
      .set({ lockedAt: new Date() })
      .where(eq(editionState.slug, edition.slug));
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 409 });
    await db()
      .update(editionState)
      .set({ lockedAt: null })
      .where(eq(editionState.slug, edition.slug));
    await seedEditions([{ ...edition, status: "completed" }]);
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 409 });
    await seedEditions([edition]);
    for (const state of [
      "ready",
      "live",
      "paused",
      "completed",
      "finalized",
    ] as const) {
      await db()
        .insert(draftSessions)
        .values({ editionSlug: edition.slug, state })
        .onConflictDoUpdate({
          target: draftSessions.editionSlug,
          set: { state },
        });
      await expect(
        addManualRegistration(admin, edition.slug, command),
      ).rejects.toMatchObject({ status: 409 });
    }
    expect(await db().select().from(registrationEvents)).toEqual([]);
  });
  it("enforces scoped roles, role revocation and strict commands before provider access", async () => {
    const staff = { osuId: 979998, username: "Synthetic scoped Admin" };
    await db().insert(users).values(staff);
    for (const role of ["mappooler", "referee"] as const) {
      await db().insert(staffRoles).values({
        userId: staff.osuId,
        role,
        editionSlug: edition.slug,
        grantedBy: admin.osuId,
      });
    }
    await expect(
      previewManualRegistration(staff, edition.slug, { input: command.input }),
    ).rejects.toMatchObject({ status: 403 });
    await db().insert(staffRoles).values({
      userId: staff.osuId,
      role: "admin",
      editionSlug: "other-test-cup",
      grantedBy: admin.osuId,
    });
    await expect(
      addManualRegistration(staff, edition.slug, command),
    ).rejects.toMatchObject({ status: 403 });
    const [grant] = await db()
      .insert(staffRoles)
      .values({
        userId: staff.osuId,
        role: "admin",
        editionSlug: edition.slug,
        grantedBy: admin.osuId,
      })
      .returning();
    await db()
      .update(staffRoles)
      .set({ revokedAt: new Date() })
      .where(eq(staffRoles.id, grant.id));
    await expect(
      addManualRegistration(staff, edition.slug, command),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      addManualRegistration(admin, edition.slug, {
        ...command,
        userId: playerId,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(provider).not.toHaveBeenCalled();
  });
  it("rejects invalid/nonexistent/upstream-unavailable identities and privacy failures", async () => {
    for (const input of [
      "https://evil.test/users/123",
      "https://osu.ppy.sh/users/name",
      "0",
      "1e3",
    ])
      await expect(
        previewManualRegistration(admin, edition.slug, { input }),
      ).rejects.toMatchObject({ status: 400 });
    expect(provider).not.toHaveBeenCalled();
    provider.mockRejectedValue(
      new (await import("../../src/lib/http")).HttpError(404, "missing"),
    );
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 404 });
    await db().delete(userProfileCache);
    provider.mockRejectedValue(new Error("provider unavailable"));
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 502 });
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "");
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 503 });
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "Synthetic policy.");
    expect(await db().select().from(registrations)).toEqual([]);
  });
  it("refuses stale fallback identity after a provider failure without erasing the cached profile", async () => {
    const snapshot = await previewManualRegistration(admin, edition.slug, {
      input: command.input,
    });
    await db().execute(
      sql`UPDATE user_profile_cache SET profile = jsonb_set(profile, '{fetchedAt}', to_jsonb('2020-01-01T00:00:00.000Z'::text)), retry_at = NOW() - INTERVAL '1 minute'`,
    );
    provider.mockRejectedValue(new Error("Synthetic provider outage"));
    await expect(
      addManualRegistration(admin, edition.slug, command),
    ).rejects.toMatchObject({ status: 503 });
    expect(
      (await db().select().from(userProfileCache))[0].profile?.username,
    ).toBe(snapshot.profile.username);
    expect(await db().select().from(registrations)).toEqual([]);
    expect(
      await db().select().from(users).where(eq(users.osuId, playerId)),
    ).toEqual([]);
  });
  it("rechecks scoped authorization after provider I/O", async () => {
    const actor = {
      osuId: 979997,
      username: "Synthetic revoked during lookup",
    };
    await db().insert(users).values(actor);
    const [grant] = await db()
      .insert(staffRoles)
      .values({
        userId: actor.osuId,
        role: "admin",
        editionSlug: edition.slug,
        grantedBy: admin.osuId,
      })
      .returning();
    provider.mockImplementationOnce(async () => {
      await db()
        .update(staffRoles)
        .set({ revokedAt: new Date() })
        .where(eq(staffRoles.id, grant.id));
      return profileResponse;
    });
    await expect(
      previewManualRegistration(actor, edition.slug, { input: command.input }),
    ).rejects.toMatchObject({ status: 403 });
    expect(await db().select().from(registrations)).toEqual([]);
    expect(await db().select().from(registrationEvents)).toEqual([]);
  });
  it("rolls back user, enrollment and audit atomically if the event write fails", async () => {
    await db().execute(
      sql`CREATE FUNCTION test_reject_manual_audit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic audit failure'; END $$`,
    );
    await db().execute(
      sql`CREATE TRIGGER test_manual_audit_failure BEFORE INSERT ON registration_events FOR EACH ROW EXECUTE FUNCTION test_reject_manual_audit()`,
    );
    try {
      await expect(
        addManualRegistration(admin, edition.slug, command),
      ).rejects.toThrow();
      expect(
        await db().select().from(users).where(eq(users.osuId, playerId)),
      ).toEqual([]);
      expect(await db().select().from(registrations)).toEqual([]);
      expect(await db().select().from(registrationEvents)).toEqual([]);
    } finally {
      await db().execute(
        sql`DROP TRIGGER test_manual_audit_failure ON registration_events`,
      );
      await db().execute(sql`DROP FUNCTION test_reject_manual_audit()`);
    }
  });
  it("retains historical player acknowledgments and rejects fabricated staff consent at the database boundary", async () => {
    await db()
      .insert(users)
      .values({ osuId: playerId, username: profileResponse.username });
    const [old] = await db()
      .insert(registrations)
      .values({
        editionSlug: edition.slug,
        userId: playerId,
        rulesVersion: "test-v1",
        eligibilityAcknowledged: true,
        configurationVersion: 0,
        answers: {},
      })
      .returning();
    expect(old.source).toBe("player");
    await expect(
      db()
        .update(registrations)
        .set({ source: "staff" })
        .where(eq(registrations.id, old.id)),
    ).rejects.toThrow();
    expect((await ownRegistrations(playerId))[0].rulesVersion).toBe("test-v1");
  });
});
