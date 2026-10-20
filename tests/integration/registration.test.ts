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
import {
  users,
  registrations,
  editionState,
  registrationEvents,
} from "../../src/db/schema";
import {
  registrationAvailability,
  submitRegistration,
  withdrawRegistration,
  ownRegistrations,
} from "../../src/lib/registrations";
import { edition } from "../fixtures/edition";
const testUrl = process.env.TEST_DATABASE_URL;
const a = { osuId: 20001, username: "Synthetic Registration A" };
const b = { osuId: 20002, username: "Synthetic Registration B" };
const valid = {
  rulesAcknowledged: true,
  configurationVersion: 0,
  eligibilityAcknowledged: true,
  rulesVersion: "test-v1",
  answers: {},
};
describe.skipIf(!testUrl)("individual registration transactions", () => {
  beforeAll(() => {
    assertTestDatabase(testUrl);
    vi.stubEnv("DATABASE_URL", testUrl!);
    vi.stubEnv("PRIVACY_CONTACT_OSU_ID", "60001");
    vi.stubEnv("PRIVACY_RETENTION_NOTICE", "Synthetic policy.");
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
    await seedEditions([edition]);
    await db().insert(users).values([a, b]);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it("commits exactly one concurrent application with a database unique constraint", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        submitRegistration(a, edition.slug, valid),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await ownRegistrations(a.osuId)).toHaveLength(1);
    expect(await ownRegistrations(b.osuId)).toHaveLength(0);
    await expect(
      db().insert(registrations).values({
        editionSlug: edition.slug,
        userId: a.osuId,
        rulesVersion: "test-v1",
        answers: {},
      }),
    ).rejects.toThrow();
    expect(await db().select().from(registrationEvents)).toHaveLength(1);
  });
  it("fails closed for missing privacy configuration without changing existing applications", async () => {
    await submitRegistration(a, edition.slug, valid);
    const saved = await ownRegistrations(a.osuId);
    try {
      for (const contact of ["", "invalid", "60001,70001"]) {
        vi.stubEnv("PRIVACY_CONTACT_OSU_ID", contact);
        expect(await registrationAvailability(edition)).toBe("unavailable");
        await expect(
          submitRegistration(b, edition.slug, valid),
        ).rejects.toMatchObject({ status: 503 });
      }
      vi.stubEnv("PRIVACY_CONTACT_OSU_ID", "60001");
      vi.stubEnv("PRIVACY_RETENTION_NOTICE", " \n ");
      await expect(
        submitRegistration(b, edition.slug, valid),
      ).rejects.toMatchObject({ status: 503 });
      expect(await ownRegistrations(a.osuId)).toEqual(saved);
      expect(await ownRegistrations(b.osuId)).toHaveLength(0);
      expect(await db().select().from(registrationEvents)).toHaveLength(1);
    } finally {
      vi.stubEnv("PRIVACY_CONTACT_OSU_ID", "60001");
      vi.stubEnv("PRIVACY_RETENTION_NOTICE", "Synthetic policy.");
    }
    expect(await registrationAvailability(edition)).toBe("open");
    expect((await submitRegistration(b, edition.slug, valid)).status).toBe(
      "pending",
    );
  });
  it("rejects forged identities/status, stale rules, invalid answers and closed windows", async () => {
    await expect(
      submitRegistration(a, edition.slug, { ...valid, userId: b.osuId }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      submitRegistration(a, edition.slug, { ...valid, status: "accepted" }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      submitRegistration(a, edition.slug, { ...valid, rulesVersion: "old" }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      submitRegistration(a, edition.slug, {
        ...valid,
        answers: { invented: "x" },
      }),
    ).rejects.toMatchObject({ status: 400 });
    await seedEditions([
      {
        ...edition,
        registration: {
          ...edition.registration,
          opensAt: "2020-01-01T00:00:00Z",
          closesAt: "2021-01-01T00:00:00Z",
        },
      },
    ]);
    await expect(
      submitRegistration(a, edition.slug, valid),
    ).rejects.toMatchObject({ status: 409 });
    expect(await ownRegistrations(a.osuId)).toHaveLength(0);
  });
  it("keeps answers private and requires approved questions with bounded responses", async () => {
    await seedEditions([
      {
        ...edition,
        registration: {
          ...edition.registration,
          questions: [
            {
              id: "approved",
              label: "Synthetic question",
              required: true,
              maxLength: 5,
            },
          ],
        },
      },
    ]);
    await expect(
      submitRegistration(a, edition.slug, valid),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      submitRegistration(a, edition.slug, {
        ...valid,
        answers: { approved: "123456" },
      }),
    ).rejects.toMatchObject({ status: 400 });
    const saved = await submitRegistration(a, edition.slug, {
      ...valid,
      answers: { approved: "  good " },
    });
    expect(saved.answers).toEqual({ approved: "good" });
    expect(saved.status).toBe("pending");
    await expect(
      withdrawRegistration(b, saved.id, { confirmed: true }),
    ).rejects.toMatchObject({ status: 404 });
  });
  it("withdraws only the owner with confirmation and records a terminal transition", async () => {
    const saved = await submitRegistration(a, edition.slug, valid);
    await expect(
      withdrawRegistration(a, saved.id, { confirmed: false }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await withdrawRegistration(a, saved.id, { confirmed: true })).status,
    ).toBe("withdrawn");
    await expect(
      withdrawRegistration(a, saved.id, { confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    expect(await db().select().from(registrationEvents)).toHaveLength(2);
  });
  it("blocks withdrawal and new applications when the edition is locked", async () => {
    expect(await registrationAvailability(edition)).toBe("open");
    const saved = await submitRegistration(a, edition.slug, valid);
    await db()
      .update(editionState)
      .set({ lockedAt: new Date() })
      .where(eq(editionState.slug, edition.slug));
    expect(await registrationAvailability(edition)).toBe("closed");
    await expect(
      withdrawRegistration(a, saved.id, { confirmed: true }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      submitRegistration(b, edition.slug, valid),
    ).rejects.toMatchObject({ status: 409 });
  });
});
