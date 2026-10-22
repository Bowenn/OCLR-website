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
  editionState,
  teams,
  memberships,
  editionEvents,
} from "../../src/db/schema";
import { prepareDraft } from "../fixtures/draft";
import { staffTeams, updateTeams, publishedTeams } from "../../src/lib/teams";
import { assertTestDatabase } from "../database";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)("targeted team identity corrections", () => {
  let f: Awaited<ReturnType<typeof prepareDraft>>;
  beforeAll(() => {
    assertTestDatabase(url);
    vi.stubEnv("DATABASE_URL", url!);
    vi.stubEnv("ADMIN_OSU_IDS", "999001");
  });
  beforeEach(async () => {
    await db().execute(sql`TRUNCATE edition_state,users CASCADE`);
    f = await prepareDraft("team-identity-test", 999001);
  });
  afterAll(async () => {
    await closeDb();
    vi.unstubAllEnvs();
  });
  it("corrects one finalized team's branding while preserving roster/capacity and publication", async () => {
    const data = await staffTeams(f.staff, "team-identity-test"),
      team = data.teams[0],
      memberBefore = await db().select().from(memberships);
    await db()
      .update(teams)
      .set({ finalizedAt: new Date() })
      .where(eq(teams.id, team.id));
    const input = {
      expectedVersion: data.version,
      confirmed: true,
      command: {
        action: "edit",
        teamId: team.id,
        name: "Synthetic corrected identity",
        capacity: team.capacity,
        avatarKey: null,
      },
    };
    const updated = await updateTeams(f.staff, "team-identity-test", input);
    expect(updated.teams.find((t) => t.id === team.id)?.name).toBe(
      "Synthetic corrected identity",
    );
    expect(await db().select().from(memberships)).toEqual(memberBefore);
    expect(
      (await publishedTeams("team-identity-test")).find((t) => t.id === team.id)
        ?.name,
    ).toBe("Synthetic corrected identity");
    await expect(
      updateTeams(f.staff, "team-identity-test", input),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateTeams(f.staff, "team-identity-test", {
        ...input,
        expectedVersion: updated.version,
        command: { ...input.command, capacity: 3 },
      }),
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      updateTeams(f.a, "team-identity-test", input),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateTeams(f.staff, "team-identity-test", {
        ...input,
        expectedVersion: updated.version,
        command: {
          ...input.command,
          avatarKey: "4ec6b145-6eca-43e5-b0d0-97bd628db098",
        },
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(
      (await db().select().from(editionEvents)).filter(
        (e) => e.kind === "team_edit",
      ),
    ).toHaveLength(1);
  });
  it("permits unlocked capacity changes but rejects shrinking below membership", async () => {
    await db()
      .update(editionState)
      .set({ lockedAt: null })
      .where(eq(editionState.slug, "team-identity-test"));
    const data = await staffTeams(f.staff, "team-identity-test"),
      team = data.teams[0];
    const input = {
      expectedVersion: data.version,
      confirmed: true,
      command: {
        action: "edit",
        teamId: team.id,
        name: team.name,
        capacity: 1,
        avatarKey: null,
      },
    };
    expect(
      (await updateTeams(f.staff, "team-identity-test", input)).teams.find(
        (t) => t.id === team.id,
      )?.capacity,
    ).toBe(1);
  });
});
