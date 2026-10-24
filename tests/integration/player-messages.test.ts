import { randomUUID } from "node:crypto";
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
  registrations,
  users,
  staffRoles,
  editionEvents,
} from "../../src/db/schema";
import { assertTestDatabase } from "../database";
import { edition } from "../fixtures/edition";
import { seedEditions } from "../fixtures/editions";
import {
  postPlayerMessage,
  changePlayerMessage,
  publicPlayerIntroductions,
  publicPlayerMessages,
} from "../../src/lib/player-messages";
const url = process.env.TEST_DATABASE_URL;
const actor = { osuId: 320001, username: "Signed Author" };
const target = 320002;
const cup = {
  ...edition,
  registration: {
    ...edition.registration!,
    publicIntroductionQuestionId: "intro",
    questions: [
      {
        id: "intro",
        type: "text",
        label: "Public self introduction",
        required: false,
        maxLength: 500,
      },
      {
        id: "contact",
        type: "text",
        label: "Private contact",
        required: false,
        maxLength: 500,
      },
    ],
  },
};
describe.skipIf(!url)(
  "signed player messages and public introduction boundaries",
  () => {
    beforeAll(() => {
      assertTestDatabase(url);
      vi.stubEnv("DATABASE_URL", url!);
    });
    beforeEach(async () => {
      await db().execute(sql`TRUNCATE edition_state, users CASCADE`);
      await seedEditions([cup]);
      await db()
        .insert(users)
        .values([
          actor,
          { osuId: target, username: "Public Player" },
          { osuId: target + 1, username: "Private Applicant" },
        ]);
      await db()
        .insert(registrations)
        .values(
          [target, target + 1].map((userId, i) => ({
            userId,
            editionSlug: cup.slug,
            status: i ? ("pending" as const) : ("accepted" as const),
            configurationVersion: 0,
            answers: {
              intro: "Literal intro\nsecond line",
              contact: "PRIVATE_CONTACT",
            },
          })),
        );
    });
    afterAll(async () => {
      await closeDb();
      vi.unstubAllEnvs();
    });
    it("projects only the selected answer for accepted players in the same published edition", async () => {
      const rows = await publicPlayerIntroductions(
        cup.slug,
        [target, target + 1],
        "intro",
      );
      expect([...rows]).toEqual([[target, "Literal intro\nsecond line"]]);
      expect(
        (await publicPlayerIntroductions(cup.slug, [target], "contact")).size,
      ).toBe(0);
      expect(
        (await publicPlayerIntroductions("other-cup", [target], "intro")).size,
      ).toBe(0);
      await seedEditions([{ ...cup, published: false }]);
      expect(
        (await publicPlayerIntroductions(cup.slug, [target], "intro")).size,
      ).toBe(0);
    });
    it("preserves the merged Developer read-only restriction", async () => {
      await db().insert(staffRoles).values({
        userId: actor.osuId,
        role: "developer",
        editionSlug: null,
        grantedBy: actor.osuId,
      });
      await expect(
        postPlayerMessage(actor, cup.slug, target, {
          requestId: randomUUID(),
          text: "blocked",
        }),
      ).rejects.toMatchObject({ status: 403 });
      expect(await publicPlayerMessages(cup.slug, target)).toEqual([]);
    });
    it("signs from the authenticated author, safely stores literal text and deduplicates concurrent retries", async () => {
      const input = {
        requestId: randomUUID(),
        text: "<script>literal</script>",
      };
      const saved = await Promise.all([
        postPlayerMessage(actor, cup.slug, target, input),
        postPlayerMessage(actor, cup.slug, target, input),
      ]);
      expect(saved[0].id).toBe(saved[1].id);
      expect(await publicPlayerMessages(cup.slug, target)).toMatchObject([
        { authorId: actor.osuId, author: actor.username, text: input.text },
      ]);
      await expect(
        postPlayerMessage(actor, cup.slug, target, {
          ...input,
          authorId: target,
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        postPlayerMessage(actor, cup.slug, target, {
          ...input,
          text: "changed",
        }),
      ).rejects.toMatchObject({ status: 409 });
    });
    it("allows only the author and rejects stale edits/deletes with transactional audit", async () => {
      const requestId = randomUUID();
      const saved = await postPlayerMessage(actor, cup.slug, target, {
        requestId,
        text: "original",
      });
      const version = saved.version;
      await expect(
        changePlayerMessage(
          { osuId: target, username: "Other" },
          cup.slug,
          target,
          saved.id,
          "edit",
          { version, text: "forged" },
        ),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        changePlayerMessage(actor, "other-cup", target, saved.id, "delete", {
          version,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        changePlayerMessage(actor, cup.slug, target + 1, saved.id, "delete", {
          version,
        }),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        changePlayerMessage(actor, cup.slug, target, saved.id, "edit", {
          version,
          text: " ",
        }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        changePlayerMessage(actor, cup.slug, target, saved.id, "edit", {
          version,
          text: "x",
          authorId: target,
        }),
      ).rejects.toMatchObject({ status: 400 });
      const results = await Promise.allSettled([
        changePlayerMessage(actor, cup.slug, target, saved.id, "edit", {
          version,
          text: "first",
        }),
        changePlayerMessage(actor, cup.slug, target, saved.id, "edit", {
          version,
          text: "second",
        }),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      expect(results.filter((r) => r.status === "rejected")).toMatchObject([
        { reason: { status: 409 } },
      ]);
      const [updated] = await publicPlayerMessages(cup.slug, target);
      expect(updated.version).not.toBe(version);
      expect(updated.createdAt).toBe(saved.createdAt);
      expect(updated.authorId).toBe(actor.osuId);
      await expect(
        changePlayerMessage(actor, cup.slug, target, saved.id, "delete", {
          version,
        }),
      ).rejects.toMatchObject({ status: 409 });
      await changePlayerMessage(actor, cup.slug, target, saved.id, "delete", {
        version: updated.version,
      });
      await expect(
        changePlayerMessage(actor, cup.slug, target, saved.id, "delete", {
          version: updated.version,
        }),
      ).rejects.toMatchObject({ status: 404 });
      expect(await publicPlayerMessages(cup.slug, target)).toEqual([]);
      await expect(
        postPlayerMessage(actor, cup.slug, target, {
          requestId,
          text: "original",
        }),
      ).rejects.toMatchObject({ status: 409 });
      const events = await db().select().from(editionEvents);
      expect(events.map((e) => e.kind)).toEqual(
        expect.arrayContaining([
          "player_message_posted",
          "player_message_edited",
          "player_message_deleted",
        ]),
      );
      expect(events).toHaveLength(3);
    });
    it("retains posting rate limits after deletion and blocks mutations when publication is withdrawn", async () => {
      for (let i = 0; i < 5; i++) {
        const saved = await postPlayerMessage(actor, cup.slug, target, {
          requestId: randomUUID(),
          text: "hello",
        });
        await changePlayerMessage(actor, cup.slug, target, saved.id, "delete", {
          version: saved.version,
        });
      }
      await expect(
        postPlayerMessage(actor, cup.slug, target, {
          requestId: randomUUID(),
          text: "sixth",
        }),
      ).rejects.toMatchObject({ status: 429 });
      // A distinct author is not subject to the first author's limit.
      const other = { osuId: target, username: "Public Player" };
      const saved = await postPlayerMessage(other, cup.slug, target, {
        requestId: randomUUID(),
        text: "retained",
      });
      await seedEditions([{ ...cup, published: false }]);
      await expect(
        changePlayerMessage(other, cup.slug, target, saved.id, "edit", {
          version: saved.version,
          text: "invisible",
        }),
      ).rejects.toMatchObject({ status: 404 });
    });
    it("rejects invisible targets, empty/long content and limits concurrent messages across targets", async () => {
      const input = { requestId: randomUUID(), text: "hello" };
      await expect(
        postPlayerMessage(actor, cup.slug, target + 1, input),
      ).rejects.toMatchObject({ status: 404 });
      await expect(
        postPlayerMessage(actor, cup.slug, target, { ...input, text: "  " }),
      ).rejects.toMatchObject({ status: 400 });
      await expect(
        postPlayerMessage(actor, cup.slug, target, {
          ...input,
          text: "x".repeat(1001),
        }),
      ).rejects.toMatchObject({ status: 400 });
      const requests = await Promise.allSettled(
        Array.from({ length: 6 }, () =>
          postPlayerMessage(actor, cup.slug, target, {
            requestId: randomUUID(),
            text: "hello",
          }),
        ),
      );
      expect(requests.filter((r) => r.status === "fulfilled")).toHaveLength(5);
      expect(requests.filter((r) => r.status === "rejected")).toHaveLength(1);
      await db()
        .update(registrations)
        .set({ status: "withdrawn" })
        .where(eq(registrations.userId, target));
      expect(await publicPlayerMessages(cup.slug, target)).toEqual([]);
    });
  },
);
