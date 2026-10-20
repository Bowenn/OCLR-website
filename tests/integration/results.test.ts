import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
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
  mappoolEntries,
  mappools,
  matchGames,
  matchImports,
  matchResults,
  resultAuditEvents,
  resultGameClaims,
  resultRevisions,
  staffRoles,
  users,
} from "../../src/db/schema";
import { fixtureCommand, fixtureForReview } from "../../src/lib/fixtures";
import { mappoolCommand } from "../../src/lib/mappools";
import {
  importFixtureMatch,
  matchReview,
  resultCommand,
  type MatchReview,
} from "../../src/lib/results";
import { fetchMatchSource } from "../../src/lib/osu-matches";
import { osuApi } from "../../src/lib/osu-api";
import { HttpError } from "../../src/lib/http";
import type { MatchSource } from "../../src/lib/match-model";
import { edition } from "../fixtures/edition";
import { seedPublicDirectory } from "../fixtures/players";
import {
  syntheticApiGame,
  syntheticEvent,
  syntheticMatchId,
  syntheticPage,
  syntheticScoringRules,
} from "../fixtures/match";
vi.mock("../../src/lib/osu-api", () => ({ osuApi: vi.fn() }));
vi.mock("../../src/lib/osu-matches", async (original) => ({
  ...(await original<typeof import("../../src/lib/osu-matches")>()),
  fetchMatchSource: vi.fn(),
}));
const url = process.env.TEST_DATABASE_URL;
const admin = { osuId: 290001, username: "Synthetic Result Admin" };
const referee = { osuId: 290002, username: "Synthetic Result Referee" };
const mapper = { osuId: 290003, username: "Synthetic Result Mappooler" };
const outsider = { osuId: 290004, username: "Synthetic Ordinary Player" };
const confirm = {
  confirmed: true,
  reason: "Synthetic controlled result rehearsal",
};
describe.skipIf(!url)(
  "authoritative MP import, review, approval and publication",
  () => {
    let scratch: string;
    let fixtureId: string;
    let poolId: string;
    let source: MatchSource;
    let fixtureBody: Record<string, unknown>;
    let actualFetch: typeof fetchMatchSource;
    beforeAll(async () => {
      if (!new URL(url!).pathname.includes("test"))
        throw new Error("Use a test database");
      scratch = mkdtempSync(join(tmpdir(), "oclr-results-"));
      const path = join(scratch, "editions.json");
      writeFileSync(path, JSON.stringify([edition]));
      vi.stubEnv("OCLR_EDITIONS_FILE", path);
      vi.stubEnv("DATABASE_URL", url!);
      vi.stubEnv("ADMIN_OSU_IDS", String(admin.osuId));
      actualFetch = (
        await vi.importActual<typeof import("../../src/lib/osu-matches")>(
          "../../src/lib/osu-matches",
        )
      ).fetchMatchSource;
    });
    async function makeSource(changed = false) {
      const roster = (await fixtureForReview(admin, "test-cup", fixtureId))
        .teams;
      const ids = roster.flatMap((t) => t.members.map((m) => m.osuId));
      const games = [
        syntheticApiGame(1, changed ? 100 : 200, changed ? 200 : 100),
        syntheticApiGame(2, 100, 200),
        syntheticApiGame(3),
      ].map((g) => ({
        ...g,
        scores: g.scores.map((s, i) => ({ ...s, user_id: ids[i] })),
      }));
      vi.mocked(osuApi).mockResolvedValue(
        syntheticPage(games.map((g, i) => syntheticEvent(i + 1, g))),
      );
      return actualFetch(syntheticMatchId);
    }
    beforeEach(async () => {
      vi.mocked(fetchMatchSource).mockReset();
      vi.mocked(osuApi).mockReset();
      await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
      const home = await seedPublicDirectory(291001);
      const away = await seedPublicDirectory(292001);
      await db().insert(users).values([admin, referee, mapper, outsider]);
      await db()
        .insert(staffRoles)
        .values([
          {
            userId: referee.osuId,
            role: "referee",
            editionSlug: "test-cup",
            grantedBy: admin.osuId,
          },
          {
            userId: mapper.osuId,
            role: "mappooler",
            editionSlug: "test-cup",
            grantedBy: admin.osuId,
          },
        ]);
      let maps = await mappoolCommand(admin, "test-cup", {
        ...confirm,
        action: "round_create",
        stage: "group",
        name: "Synthetic Result Round",
        position: 1,
      });
      const roundId = maps.rounds[0].id;
      maps = await mappoolCommand(admin, "test-cup", {
        ...confirm,
        action: "pool_create",
        roundId,
        name: "Synthetic Result Pool",
      });
      poolId = maps.pools[0].id;
      await db()
        .insert(mappoolEntries)
        .values(
          [1, 2, 3].map((position) => ({
            poolId,
            category: "NM" as const,
            position,
            beatmapId: 10000 + position,
            metadata: {
              setId: 42,
              artist: "Synthetic Artist",
              title: `Synthetic Map ${position}`,
              difficulty: "Synthetic Difficulty",
              mapper: "Synthetic Mapper",
              stars: 4,
              bpm: 180,
              duration: 90,
            },
          })),
        );
      await fixtureCommand(admin, "test-cup", {
        ...confirm,
        action: "round_rules",
        roundId,
        expectedVersion: 0,
        scoringRules: syntheticScoringRules,
        standingsRules: null,
      });
      fixtureBody = {
        ...confirm,
        action: "create",
        label: "Synthetic Result Fixture",
        roundId,
        homeTeamId: home.teamId,
        awayTeamId: away.teamId,
        position: 1,
        scheduledAt: null,
        timeZone: "Asia/Taipei",
        status: "scheduled",
        mappoolId: poolId,
        homeSourceId: null,
        homeSourceOutcome: null,
        awaySourceId: null,
        awaySourceOutcome: null,
        refereeIds: [referee.osuId],
      };
      fixtureId = (await fixtureCommand(admin, "test-cup", fixtureBody))
        .fixtures[0].id;
      source = await makeSource();
      vi.mocked(fetchMatchSource).mockResolvedValue(source);
    });
    afterAll(async () => {
      await closeDb();
      vi.unstubAllEnvs();
      rmSync(scratch, { recursive: true, force: true });
    });
    function base(view: MatchReview) {
      return {
        ...confirm,
        requestKey: randomUUID(),
        expectedVersion: view.context.result?.version ?? 0,
        expectedFixtureVersion: view.context.fixture.version,
      };
    }
    async function imported(id = fixtureId) {
      const view = await matchReview(referee, "test-cup", id);
      return importFixtureMatch(referee, "test-cup", id, {
        ...base(view),
        match: String(syntheticMatchId),
      });
    }
    function submission(view: MatchReview) {
      return {
        ...base(view),
        action: "submit",
        importId: view.importId!,
        rulesConfirmed: true,
        sourceChangesConfirmed: true,
        publicNote: "Synthetic public result note",
        decisions: view.source!.games.map((g) => ({
          gameId: g.id,
          included: true,
          complianceConfirmed: true,
          reason: "Synthetic explicit game review",
          substitutions: [],
        })),
      };
    }
    async function approved(view: MatchReview) {
      return (
        await resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "approve",
          revision: view.context.result!.currentRevision,
        })
      ).review;
    }
    async function published(view: MatchReview) {
      if (!view.context.fixture.publishedAt) {
        await fixtureCommand(admin, "test-cup", {
          ...confirm,
          action: "publish",
          fixtureId,
          expectedVersion: view.context.fixture.version,
          published: true,
        });
        view = await matchReview(admin, "test-cup", fixtureId);
      }
      return (
        await resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "publish",
          revision: view.context.result!.currentRevision,
          progressionAcknowledged: true,
        })
      ).review;
    }
    it("persists source evidence, requires referee review/Admin approval, and publishes only an approved revision", async () => {
      let view = await imported();
      expect(view.context.result).toMatchObject({
        state: "draft",
        currentRevision: 0,
        publishedRevision: null,
      });
      view = (
        await resultCommand(referee, "test-cup", fixtureId, submission(view))
      ).review;
      expect(view.context.result).toMatchObject({
        state: "submitted",
        currentRevision: 1,
        publishedRevision: null,
      });
      expect(view.current?.proposal?.series).toMatchObject({
        homeWins: 2,
        awayWins: 1,
        complete: true,
      });
      await expect(
        resultCommand(referee, "test-cup", fixtureId, {
          ...base(view),
          action: "approve",
          revision: 1,
        }),
      ).rejects.toMatchObject({ status: 403 });
      await expect(
        resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "publish",
          revision: 1,
          progressionAcknowledged: true,
        }),
      ).rejects.toMatchObject({ status: 409 });
      view = await approved(view);
      expect(view.current?.approvedBy).toBe(admin.osuId);
      expect(view.context.result?.publishedRevision).toBeNull();
      view = await published(view);
      expect(view.context.result?.publishedRevision).toBe(1);
      expect(view.published?.proposal?.series.homeWins).toBe(2);
      expect(
        (await db().select().from(mappools).where(eq(mappools.id, poolId)))[0]
          .lockedAt,
      ).not.toBeNull();
      await expect(
        mappoolCommand(mapper, "test-cup", {
          ...confirm,
          action: "entry_remove",
          poolId,
          expectedVersion: 0,
          entryId: (await db().select().from(mappoolEntries))[0].id,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (await db().select().from(resultAuditEvents)).filter(
          (e) => e.action === "result_approve",
        )[0].actorId,
      ).toBe(admin.osuId);
      await closeDb();
      expect(
        (await matchReview(referee, "test-cup", fixtureId)).context.result
          ?.publishedRevision,
      ).toBe(1);
    });
    it("keeps repeated imports and exact command retries idempotent without duplicating games or reports", async () => {
      const initial = await matchReview(referee, "test-cup", fixtureId);
      const payload = { ...base(initial), match: String(syntheticMatchId) };
      let view = await importFixtureMatch(
        referee,
        "test-cup",
        fixtureId,
        payload,
      );
      const calls = vi.mocked(fetchMatchSource).mock.calls.length;
      await importFixtureMatch(referee, "test-cup", fixtureId, payload);
      expect(vi.mocked(fetchMatchSource).mock.calls).toHaveLength(calls);
      view = await importFixtureMatch(referee, "test-cup", fixtureId, {
        ...base(view),
        match: String(syntheticMatchId),
      });
      expect(await db().select().from(matchImports)).toHaveLength(1);
      expect(await db().select().from(matchGames)).toHaveLength(3);
      expect(view.context.result?.version).toBe(1);
      const submit = submission(view);
      await resultCommand(referee, "test-cup", fixtureId, submit);
      await resultCommand(referee, "test-cup", fixtureId, submit);
      expect(await db().select().from(resultRevisions)).toHaveLength(1);
      expect(
        (await db().select().from(resultAuditEvents)).filter(
          (e) => e.action === "result_submit",
        ),
      ).toHaveLength(1);
      await expect(
        resultCommand(referee, "test-cup", fixtureId, {
          ...submit,
          publicNote: "Different payload",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("commits one competing referee/Admin submission and returns a conflict to the other", async () => {
      const view = await imported();
      const payload = submission(view);
      const results = await Promise.allSettled([
        resultCommand(referee, "test-cup", fixtureId, payload),
        resultCommand(admin, "test-cup", fixtureId, {
          ...payload,
          requestKey: randomUUID(),
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.find((r) => r.status === "rejected")).toMatchObject({
        reason: { status: 409 },
      });
      expect(await db().select().from(resultRevisions)).toHaveLength(1);
    });
    it("detects changed upstream facts and preserves the published result until a new reviewed correction is approved/published", async () => {
      let view = await imported();
      view = (
        await resultCommand(referee, "test-cup", fixtureId, submission(view))
      ).review;
      view = await published(await approved(view));
      const oldProposal = view.published!.proposal;
      const changed = await makeSource(true);
      vi.mocked(fetchMatchSource).mockResolvedValue(changed);
      view = await importFixtureMatch(referee, "test-cup", fixtureId, {
        ...base(view),
        match: String(syntheticMatchId),
      });
      expect(view.diff?.changed).toEqual([1]);
      expect(view.published?.proposal).toEqual(oldProposal);
      expect(view.context.result?.publishedRevision).toBe(1);
      await expect(
        resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "publish",
          revision: 1,
          progressionAcknowledged: true,
        }),
      ).rejects.toMatchObject({ status: 409 });
      const payload = submission(view);
      payload.decisions[2] = {
        ...payload.decisions[2],
        included: false,
        reason: "Synthetic extra game after corrected series",
      };
      payload.publicNote = "Synthetic corrected public note";
      view = (await resultCommand(referee, "test-cup", fixtureId, payload))
        .review;
      expect(view.current?.proposal?.series).toMatchObject({
        awayWins: 2,
        homeWins: 0,
      });
      expect(view.context.result?.publishedRevision).toBe(1);
      view = await approved(view);
      expect(await db().select().from(resultGameClaims)).toHaveLength(3);
      expect(view.context.result?.publishedRevision).toBe(1);
      view = await published(view);
      expect(view.context.result?.publishedRevision).toBe(2);
      expect(await db().select().from(resultGameClaims)).toHaveLength(2);
      expect(view.revisions.find((r) => r.revision === 1)?.proposal).toEqual(
        oldProposal,
      );
    });
    it("prevents the same source games from being approved for two distinct fixtures", async () => {
      let one = await imported();
      one = (
        await resultCommand(referee, "test-cup", fixtureId, submission(one))
      ).review;
      await approved(one);
      const second = (
        await fixtureCommand(admin, "test-cup", {
          ...fixtureBody,
          label: "Synthetic Duplicate Source Fixture",
          position: 2,
        })
      ).fixtures.find((f) => f.position === 2)!;
      let two = await imported(second.id);
      two = (
        await resultCommand(referee, "test-cup", second.id, submission(two))
      ).review;
      await expect(
        resultCommand(admin, "test-cup", second.id, {
          ...base(two),
          action: "approve",
          revision: 1,
        }),
      ).rejects.toMatchObject({ status: 409 });
      expect(
        (await matchReview(admin, "test-cup", second.id)).context.result?.state,
      ).toBe("submitted");
      expect(await db().select().from(resultGameClaims)).toHaveLength(3);
    });
    it("denies wrong roles, revoked roles, forged fields and invalid game review without provider side effects", async () => {
      const view = await matchReview(admin, "test-cup", fixtureId);
      for (const actor of [mapper, outsider]) {
        await expect(
          matchReview(actor, "test-cup", fixtureId),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          importFixtureMatch(actor, "test-cup", fixtureId, {
            ...base(view),
            match: String(syntheticMatchId),
          }),
        ).rejects.toMatchObject({ status: 403 });
        await expect(
          resultCommand(actor, "test-cup", fixtureId, {}),
        ).rejects.toMatchObject({ status: 403 });
      }
      expect(fetchMatchSource).not.toHaveBeenCalled();
      let current = await imported();
      const payload = submission(current);
      await expect(
        resultCommand(referee, "test-cup", fixtureId, {
          ...payload,
          actorId: admin.osuId,
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        resultCommand(referee, "test-cup", fixtureId, {
          ...payload,
          decisions: payload.decisions.slice(0, 1),
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        resultCommand(referee, "test-cup", fixtureId, {
          ...payload,
          decisions: payload.decisions.map((d) => ({
            ...d,
            complianceConfirmed: false,
          })),
        }),
      ).rejects.toMatchObject({ status: 400 });
      current = (await resultCommand(referee, "test-cup", fixtureId, payload))
        .review;
      for (const action of [
        { action: "approve", revision: 1 },
        { action: "publish", revision: 1, progressionAcknowledged: true },
        { action: "reject", revision: 1 },
        { action: "unpublish" },
        { action: "void", progressionAcknowledged: true },
      ])
        await expect(
          resultCommand(referee, "test-cup", fixtureId, {
            ...base(current),
            ...action,
          }),
        ).rejects.toMatchObject({ status: 403 });
      await db()
        .update(staffRoles)
        .set({ revokedAt: new Date() })
        .where(eq(staffRoles.userId, referee.osuId));
      await expect(
        matchReview(referee, "test-cup", fixtureId),
      ).rejects.toMatchObject({ status: 403 });
    });
    it("does not corrupt saved official results when provider retrieval fails", async () => {
      let view = await imported();
      view = (
        await resultCommand(referee, "test-cup", fixtureId, submission(view))
      ).review;
      view = await published(await approved(view));
      const before = (await db().select().from(matchResults))[0];
      const count = (await db().select().from(resultAuditEvents)).length;
      vi.mocked(fetchMatchSource).mockRejectedValue(
        new HttpError(502, "Synthetic provider outage"),
      );
      await expect(
        importFixtureMatch(referee, "test-cup", fixtureId, {
          ...base(view),
          match: String(syntheticMatchId),
        }),
      ).rejects.toMatchObject({ status: 502 });
      expect((await db().select().from(matchResults))[0]).toEqual(before);
      expect(await db().select().from(matchImports)).toHaveLength(1);
      expect(await db().select().from(resultAuditEvents)).toHaveLength(count);
    });
    it("rejects and withdraws reports through audited Admin commands without inventing a forfeit or deleting history", async () => {
      let view = await imported();
      view = (
        await resultCommand(referee, "test-cup", fixtureId, submission(view))
      ).review;
      view = (
        await resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "reject",
          revision: 1,
        })
      ).review;
      expect(view.context.result?.state).toBe("draft");
      expect(view.current?.approvedAt).toBeNull();
      view = (
        await resultCommand(referee, "test-cup", fixtureId, submission(view))
      ).review;
      view = await published(await approved(view));
      view = (
        await resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "unpublish",
        })
      ).review;
      expect(view.context.result?.publishedRevision).toBeNull();
      view = (
        await resultCommand(admin, "test-cup", fixtureId, {
          ...base(view),
          action: "void",
          progressionAcknowledged: true,
        })
      ).review;
      expect(view.context.result).toMatchObject({
        state: "draft",
        publishedRevision: null,
        currentRevision: 2,
      });
      expect(view.revisions).toHaveLength(2);
      expect(await db().select().from(resultGameClaims)).toHaveLength(0);
    });
  },
);
