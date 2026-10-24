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
import { registrations, users } from "../../src/db/schema";
import { assertTestDatabase } from "../database";
import { edition } from "../fixtures/edition";
import { seedEditions } from "../fixtures/editions";
import {
  postPlayerMessage,
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
