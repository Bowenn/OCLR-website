import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { sql } from "drizzle-orm";
import { assertTestDatabase } from "../database";
import { db, closeDb } from "../../src/db";
import { readTournament, readTournaments } from "../../src/lib/tournaments";
import { seedEditions } from "../fixtures/editions";
import { edition } from "../fixtures/edition";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("authoritative tournament edition storage", () => {
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state CASCADE`);
    await seedEditions([
      edition,
      { ...edition, slug: "private-test-cup", published: false },
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
  it("rejects primary-key slug changes at the database boundary", async () => {
    await expect(
      db().execute(
        sql`UPDATE edition_state SET slug = 'renamed' WHERE slug = 'test-cup'`,
      ),
    ).rejects.toThrow();
    expect((await readTournament("test-cup"))?.edition.name).toBe(edition.name);
  });
});
