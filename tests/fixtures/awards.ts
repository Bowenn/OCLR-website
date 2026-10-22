import { createHash, randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../../src/db";
import {
  fixtures,
  matchGames,
  matchImports,
  tournamentRounds,
} from "../../src/db/schema";
import { seedResultReview } from "./results";
import { resultCommand } from "../../src/lib/results";
import { assertTestDatabase } from "../database";
export const awardWeeks = [1, 2].map((number) => ({
  number,
  startsAt: `2026-10-${number === 1 ? "01" : "08"}T00:00:00Z`,
  endsAt: `2026-10-${number === 1 ? "08" : "15"}T00:00:00Z`,
}));
export async function seedAwardReview(
  adminId = 60001,
  refereeId = 60101,
  base = 1130000,
) {
  assertTestDatabase(process.env.TEST_DATABASE_URL);
  const seeded = await seedResultReview(adminId, refereeId, base);
  const source = structuredClone(seeded.source);
  source.games = Array.from({ length: 6 }, (_, index) => ({
    ...source.games[index % 3],
    id: 1130000 + index,
  }));
  source.events = source.games.map((g, i) => ({
    id: i + 1,
    at: g.endTime!,
    type: "other",
    actorOsuId: null,
    gameId: g.id,
  }));
  source.fingerprint = createHash("sha256")
    .update(JSON.stringify(source.games))
    .digest("hex");
  await db()
    .update(matchImports)
    .set({ source, fingerprint: source.fingerprint })
    .where(eq(matchImports.id, seeded.importId));
  await db().delete(matchGames).where(eq(matchGames.importId, seeded.importId));
  await db()
    .insert(matchGames)
    .values(
      source.games.map((g) => ({
        importId: seeded.importId,
        externalGameId: g.id,
        beatmapId: g.beatmapId,
        data: g,
      })),
    );
  const scoringRules = {
    ...seeded.context.round.scoringRules!,
    series: { type: "fixed_maps" as const, count: 6, allowDraw: true },
  };
  await db()
    .update(tournamentRounds)
    .set({ scoringRules })
    .where(eq(tournamentRounds.id, seeded.context.round.id));
  await db()
    .update(fixtures)
    .set({ scheduledAt: new Date("2026-10-03T12:00:00Z") })
    .where(eq(fixtures.id, seeded.fixtureId));
  const actor = { osuId: adminId, username: "Synthetic Admin" };
  const reviewed = await resultCommand(actor, "test-cup", seeded.fixtureId, {
    action: "submit",
    confirmed: true,
    requestKey: randomUUID(),
    expectedVersion: 1,
    expectedFixtureVersion: 1,
    importId: seeded.importId,
    rulesConfirmed: true,
    sourceChangesConfirmed: true,
    publicNote: "",
    decisions: source.games.map((g) => ({
      gameId: g.id,
      included: true,
      reason:
        "Synthetic fixture-only review: attribution and map compliance confirmed.",
      complianceConfirmed: true,
      substitutions: [],
    })),
  });
  await resultCommand(actor, "test-cup", seeded.fixtureId, {
    action: "approve_publish",
    confirmed: true,
    requestKey: randomUUID(),
    expectedVersion: reviewed.review.context.result!.version,
    expectedFixtureVersion: 1,
    revision: 1,
    progressionAcknowledged: true,
  });
  return { ...seeded, source };
}
