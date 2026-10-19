import { ownTeam } from "../../src/lib/teams";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { isNull, sql } from "drizzle-orm";
import { db, closeDb } from "../../src/db";
import {
  draftPicks,
  draftSessions,
  memberships,
  teams,
} from "../../src/db/schema";
import {
  captainDraft,
  draftCommand,
  pickPlayer,
  publicDraft,
  staffDraft,
} from "../../src/lib/draft";
import { prepareDraft } from "../fixtures/draft";
import { edition } from "../fixtures/edition";
const url = process.env.TEST_DATABASE_URL;
describe.skipIf(!url)(
  "authoritative two-mode draft transactions and publication",
  () => {
    let scratch: string;
    let fixture: Awaited<ReturnType<typeof prepareDraft>>;
    beforeAll(() => {
      if (!new URL(url!).pathname.includes("test"))
        throw new Error("Use a test database");
      scratch = mkdtempSync(join(tmpdir(), "oclr-draft-"));
      const path = join(scratch, "editions.json");
      writeFileSync(path, JSON.stringify([edition]));
      vi.stubEnv("DATABASE_URL", url!);
      vi.stubEnv("STAFF_OSU_IDS", "100001");
      vi.stubEnv("OCLR_EDITIONS_FILE", path);
    });
    beforeEach(async () => {
      await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
      fixture = await prepareDraft(edition.slug, 100001);
    });
    afterAll(async () => {
      await closeDb();
      vi.unstubAllEnvs();
      rmSync(scratch, { recursive: true, force: true });
    });
    async function input(candidate = fixture.players[0].osuId) {
      const session = (await staffDraft(fixture.staff, edition.slug)).session!;
      return {
        sessionId: session.id,
        turnIndex: session.turnIndex,
        candidateId: candidate,
        expectedVersion: session.version,
        idempotencyKey: randomUUID(),
      };
    }
    async function command(action: string) {
      const session = (await staffDraft(fixture.staff, edition.slug)).session!;
      return draftCommand(fixture.staff, edition.slug, {
        command: { action },
        expectedVersion: session.version,
        reason: "Synthetic supervised test command.",
        confirmed: true,
      });
    }
    it("allows only the active captain and records staff-on-behalf as the on-clock captain’s pick", async () => {
      const value = await input();
      await expect(
        pickPlayer(fixture.b, edition.slug, value),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        pickPlayer(fixture.players[1], edition.slug, value),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        draftCommand(fixture.a, edition.slug, {}),
      ).rejects.toMatchObject({ status: 403 });
      const first = await pickPlayer(fixture.a, edition.slug, value);
      await command("publish");
      const second = await pickPlayer(
        fixture.staff,
        edition.slug,
        await input(fixture.players[1].osuId),
      );
      const picks = await db().select().from(draftPicks);
      expect(picks[0]).toMatchObject({
        captainId: fixture.a.osuId,
        actorId: fixture.a.osuId,
        mode: "captain_direct",
        teamId: first.teamId,
      });
      expect(picks[1]).toMatchObject({
        captainId: fixture.b.osuId,
        actorId: fixture.staff.osuId,
        mode: "staff_on_behalf",
        teamId: second.teamId,
      });
      expect(
        (await staffDraft(fixture.staff, edition.slug)).session?.state,
      ).toBe("completed");
      expect(
        (
          await db()
            .select()
            .from(memberships)
            .where(isNull(memberships.leftAt))
        ).length,
      ).toBe(4);
    });
    it("commits exactly one competing captain/staff pick with matching roster and one turn advance", async () => {
      const value = await input();
      const results = await Promise.allSettled([
        pickPlayer(fixture.a, edition.slug, value),
        pickPlayer(fixture.staff, edition.slug, {
          ...value,
          candidateId: fixture.players[1].osuId,
          idempotencyKey: randomUUID(),
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toHaveLength(1);
      const snapshot = await staffDraft(fixture.staff, edition.slug);
      expect(snapshot.session?.turnIndex).toBe(1);
      expect(snapshot.picks).toHaveLength(1);
      expect(
        snapshot.members.filter((m) => m.membership.origin === "draft"),
      ).toHaveLength(1);
    });
    it("enforces database active-turn/player uniqueness in addition to service locks", async () => {
      await pickPlayer(fixture.a, edition.slug, await input());
      const [row] = await db().select().from(draftPicks);
      await expect(
        db()
          .insert(draftPicks)
          .values({
            ...row,
            id: randomUUID(),
            actorId: fixture.staff.osuId,
            requestKey: randomUUID(),
          }),
      ).rejects.toThrow();
      await expect(
        db()
          .insert(draftPicks)
          .values({
            ...row,
            id: randomUUID(),
            turnIndex: 1,
            requestKey: randomUUID(),
          }),
      ).rejects.toThrow();
    });
    it("retries are idempotent for both callers and reject altered payloads with the same key", async () => {
      const a = await input();
      const savedA = await pickPlayer(fixture.a, edition.slug, a);
      expect(await pickPlayer(fixture.a, edition.slug, a)).toEqual(savedA);
      await expect(
        pickPlayer(fixture.a, edition.slug, {
          ...a,
          candidateId: fixture.players[1].osuId,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await command("publish");
      const b = await input(fixture.players[1].osuId);
      const savedB = await pickPlayer(fixture.staff, edition.slug, b);
      expect(await pickPlayer(fixture.staff, edition.slug, b)).toEqual(savedB);
      await expect(
        pickPlayer(fixture.staff, edition.slug, {
          ...b,
          candidateId: fixture.players[2].osuId,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(await db().select().from(draftPicks)).toHaveLength(2);
    });
    it("does not expose committed unpublished picks or internal actor/audit data through public/captain snapshots", async () => {
      const original = await publicDraft(edition.slug);
      await pickPlayer(fixture.staff, edition.slug, await input());
      expect(
        (await ownTeam(fixture.a.osuId, edition.slug))?.members,
      ).toHaveLength(1);
      expect(await publicDraft(edition.slug)).toEqual(original);
      expect((await captainDraft(fixture.b, edition.slug))?.picks).toHaveLength(
        0,
      );
      await command("publish");
      const publicData = await publicDraft(edition.slug);
      expect(publicData?.picks).toHaveLength(1);
      expect(
        (await ownTeam(fixture.a.osuId, edition.slug))?.members,
      ).toHaveLength(2);
      expect(publicData?.picks[0].team.captain.osuId).toBe(fixture.a.osuId);
      expect(publicData?.pool).toBeNull();
      const text = JSON.stringify(publicData);
      for (const secret of [
        "actorId",
        "staff_on_behalf",
        "requestKey",
        "requestHash",
        "reason",
        "Synthetic Operator",
      ])
        expect(text).not.toContain(secret);
    });
    it("rejects paused, stale, unavailable, forged team/actor and cross-edition requests", async () => {
      const value = await input();
      await expect(
        pickPlayer(fixture.a, edition.slug, {
          ...value,
          captainId: fixture.b.osuId,
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        pickPlayer(fixture.a, "unpublished", value),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        pickPlayer(fixture.a, edition.slug, {
          ...value,
          candidateId: fixture.a.osuId,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await command("pause");
      await expect(
        pickPlayer(fixture.a, edition.slug, value),
      ).rejects.toMatchObject({ status: 409 });
      await expect(
        pickPlayer(fixture.staff, edition.slug, value),
      ).rejects.toMatchObject({ status: 409 });
      await command("resume");
      await expect(
        pickPlayer(fixture.staff, edition.slug, await input()),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("undo is explicit, preserves history and blocks new picks until correction/resume is published", async () => {
      const value = await input();
      await pickPlayer(fixture.a, edition.slug, value);
      await command("publish");
      await command("pause");
      await command("undo");
      const state = await staffDraft(fixture.staff, edition.slug);
      expect(state.session?.turnIndex).toBe(0);
      expect(state.picks[0].voidedAt).not.toBeNull();
      expect(
        state.members.filter((m) => m.membership.origin === "draft"),
      ).toHaveLength(0);
      expect((await publicDraft(edition.slug))?.picks).toHaveLength(1);
      await command("publish");
      expect((await publicDraft(edition.slug))?.picks).toHaveLength(0);
      await command("resume");
      await command("publish");
      const next = await pickPlayer(fixture.a, edition.slug, await input());
      expect(next.corrected).toBe(false);
      expect((await pickPlayer(fixture.a, edition.slug, value)).corrected).toBe(
        true,
      );
    });
    it("aborts safely and reopens setup only through audited recovery", async () => {
      await pickPlayer(fixture.staff, edition.slug, await input());
      await command("pause");
      await command("abort");
      await command("publish");
      expect((await publicDraft(edition.slug))?.state).toBe("aborted");
      const recovered = await command("recover");
      expect(recovered.session?.state).toBe("setup");
      expect(recovered.edition?.lockedAt).toBeNull();
      expect(await publicDraft(edition.slug)).toBeNull();
      expect(recovered.picks[0].voidedAt).not.toBeNull();
    });
    it("reconstructs an ongoing draft in a fresh Node.js process", async () => {
      await pickPlayer(fixture.staff, edition.slug, await input());
      const before = await staffDraft(fixture.staff, edition.slug);
      await closeDb();
      const expected = createHash("sha256")
        .update(
          JSON.stringify({
            session: before.session,
            picks: before.picks,
            members: before.members,
          }),
        )
        .digest("hex");
      const code = `import { staffDraft } from './src/lib/draft.ts'; import { closeDb } from './src/db/index.ts'; import { createHash } from 'node:crypto'; const data = await staffDraft(${JSON.stringify(fixture.staff)}, ${JSON.stringify(edition.slug)}); console.log(createHash('sha256').update(JSON.stringify({session:data.session,picks:data.picks,members:data.members})).digest('hex')); await closeDb();`;
      const fresh = execFileSync(
        process.execPath,
        ["--import", "tsx", "--input-type=module", "-e", code],
        {
          cwd: process.cwd(),
          env: process.env,
          encoding: "utf8",
          timeout: 10000,
        },
      ).trim();
      expect(fresh).toBe(expected);
      const after = await staffDraft(fixture.staff, edition.slug);
      expect(after.session).toEqual(before.session);
      expect(after.picks).toEqual(before.picks);
      expect(after.members).toEqual(before.members);
    });
    it("finalizes only completed published picks and freezes team roster identities", async () => {
      await expect(command("finalize")).rejects.toMatchObject({ status: 409 });
      await pickPlayer(fixture.a, edition.slug, await input());
      await command("publish");
      await pickPlayer(
        fixture.staff,
        edition.slug,
        await input(fixture.players[1].osuId),
      );
      await expect(command("finalize")).rejects.toMatchObject({ status: 409 });
      await command("publish");
      await command("finalize");
      expect(
        (await db().select().from(teams)).every(
          (t) => t.finalizedAt && !t.rosterPublished,
        ),
      ).toBe(true);
      await expect(command("undo")).rejects.toMatchObject({ status: 409 });
      await expect(command("abort")).rejects.toMatchObject({ status: 409 });
      await expect(
        pickPlayer(
          fixture.staff,
          edition.slug,
          await input(fixture.players[2].osuId),
        ),
      ).rejects.toMatchObject({ status: 409 });
      expect((await db().select().from(draftSessions))[0].state).toBe(
        "finalized",
      );
    });
  },
);
