import { z } from "zod";
export const AWARD_POLICY = "relative-game-mean-v1";
export const awardWeekSchema = z
  .object({
    number: z.number().int().min(1).max(52),
    startsAt: z.iso.datetime({ offset: true }),
    endsAt: z.iso.datetime({ offset: true }),
  })
  .strict()
  .refine(
    (week) => Date.parse(week.startsAt) < Date.parse(week.endsAt),
    "Week end must follow its start.",
  );
export const awardConfigurationSchema = z
  .object({
    weeks: z.array(awardWeekSchema).max(52),
    tiers: z
      .array(
        z
          .object({
            userId: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
            tier: z.number().int().min(1).max(99),
          })
          .strict(),
      )
      .max(10000),
  })
  .strict()
  .superRefine(({ weeks, tiers }, context) => {
    weeks.forEach((week, index) => {
      if (
        week.number !== index + 1 ||
        (index > 0 &&
          Date.parse(week.startsAt) < Date.parse(weeks[index - 1].endsAt))
      )
        context.addIssue({
          code: "custom",
          path: ["weeks", index],
          message: "Weeks must be numbered consecutively and must not overlap.",
        });
    });
    if (new Set(tiers.map((tier) => tier.userId)).size !== tiers.length)
      context.addIssue({
        code: "custom",
        path: ["tiers"],
        message: "Assign each player's Tier once.",
      });
  });
export type AwardWeek = z.infer<typeof awardWeekSchema>;
export type AwardTier = z.infer<
  typeof awardConfigurationSchema
>["tiers"][number];
export type AwardGame = {
  gameId: number;
  fixtureId: string;
  at: string | null;
  revision: number;
  fingerprint: string;
  scores: { userId: number; total: number }[];
  problem?: string;
};
export type AwardCandidate = {
  userId: number;
  tier: number | null;
  appearances: number;
  performance: number;
  previousAppearances: number;
  previousPerformance: number | null;
  improvement: number | null;
};
export type AwardStanding = {
  candidates: AwardCandidate[];
  mvp: number[];
  mip: number[];
  rookie: number[];
  issues: string[];
  evidence: {
    gameId: number;
    fixtureId: string;
    revision: number;
    at: string | null;
    fingerprint: string;
  }[];
};
// Ratio and weekly mean use 9 decimal places, rounded half up. Keep integer
// units for deterministic comparisons; percentages therefore have 7 decimals.
const scale = 1_000_000_000n;
export function weeklyStandings(
  weeks: AwardWeek[],
  tiers: AwardTier[],
  games: AwardGame[],
) {
  const totals = weeks.map(
    () => new Map<number, { units: bigint; count: number }>(),
  );
  const issues = weeks.map(() => [] as string[]);
  const evidence = weeks.map(() => [] as AwardStanding["evidence"]);
  const byGame = new Map<number, AwardGame[]>();
  for (const game of games)
    byGame.set(game.gameId, [...(byGame.get(game.gameId) ?? []), game]);
  for (const duplicates of byGame.values()) {
    const game = duplicates[0];
    const weekIndex = game.at
      ? weeks.findIndex(
          (week) =>
            Date.parse(game.at!) >= Date.parse(week.startsAt) &&
            Date.parse(game.at!) < Date.parse(week.endsAt),
        )
      : -1;
    const affected = new Set(
      duplicates.flatMap((entry) =>
        entry.at && Number.isFinite(Date.parse(entry.at))
          ? weeks.flatMap((week, index) =>
              Date.parse(entry.at!) >= Date.parse(week.startsAt) &&
              Date.parse(entry.at!) < Date.parse(week.endsAt)
                ? [index]
                : [],
            )
          : weeks.map((_, i) => i),
      ),
    );
    const conflict = duplicates.some(
      (entry) => JSON.stringify(entry) !== JSON.stringify(game),
    );
    const invalid =
      game.problem ||
      conflict ||
      !game.at ||
      !Number.isFinite(Date.parse(game.at)) ||
      !game.scores.length ||
      new Set(game.scores.map((s) => s.userId)).size !== game.scores.length ||
      game.scores.some(
        (s) =>
          !Number.isSafeInteger(s.userId) ||
          s.userId <= 0 ||
          !Number.isSafeInteger(s.total) ||
          s.total < 0,
      );
    const best = Math.max(0, ...game.scores.map((s) => s.total));
    if (invalid || best === 0) {
      for (const index of affected)
        issues[index].push(
          `Game ${game.gameId}: ${game.problem || (conflict ? "conflicting duplicate" : !game.at ? "missing fixture time" : "unverified or incomparable scores")}`,
        );
      continue;
    }
    if (weekIndex < 0) continue;
    const denominator = BigInt(best);
    for (const score of game.scores) {
      const current = totals[weekIndex].get(score.userId) ?? {
        units: 0n,
        count: 0,
      };
      current.units +=
        (BigInt(score.total) * scale + denominator / 2n) / denominator;
      current.count++;
      totals[weekIndex].set(score.userId, current);
    }
    evidence[weekIndex].push({
      gameId: game.gameId,
      fixtureId: game.fixtureId,
      revision: game.revision,
      at: game.at,
      fingerprint: game.fingerprint,
    });
  }
  const mean = (value: { units: bigint; count: number }) =>
    Number(
      (value.units + BigInt(Math.floor(value.count / 2))) / BigInt(value.count),
    );
  const tierMap = new Map(tiers.map((tier) => [tier.userId, tier.tier]));
  return weeks.map((week, index): AwardWeek & AwardStanding => {
    const candidates = [...totals[index]]
      .map(([userId, value]) => {
        const previous = index ? totals[index - 1].get(userId) : undefined;
        const performance = mean(value),
          previousPerformance = previous ? mean(previous) : null;
        return {
          userId,
          tier: tierMap.get(userId) ?? null,
          appearances: value.count,
          performance,
          previousAppearances: previous?.count ?? 0,
          previousPerformance,
          improvement:
            previousPerformance === null
              ? null
              : performance - previousPerformance,
        };
      })
      .sort((a, b) => b.performance - a.performance || a.userId - b.userId);
    function leaders(
      rows: AwardCandidate[],
      value: "performance" | "improvement",
    ) {
      if (!rows.length) return [];
      const top = Math.max(...rows.map((row) => row[value]!));
      return rows.filter((row) => row[value] === top).map((row) => row.userId);
    }
    return {
      ...week,
      candidates,
      mvp: leaders(
        candidates.filter((row) => row.appearances >= 6),
        "performance",
      ),
      mip: index
        ? leaders(
            candidates.filter(
              (row) =>
                row.appearances >= 5 &&
                row.previousAppearances >= 5 &&
                row.improvement !== null &&
                row.improvement > 0,
            ),
            "improvement",
          )
        : [],
      rookie: leaders(
        candidates.filter(
          (row) => row.appearances >= 5 && row.tier !== null && row.tier >= 4,
        ),
        "performance",
      ),
      issues: [
        ...new Set([
          ...issues[index],
          ...(index
            ? issues[index - 1].map((issue) => `Previous week: ${issue}`)
            : []),
        ]),
      ],
      evidence: [
        ...evidence[index],
        ...(index ? evidence[index - 1] : []),
      ].sort((a, b) => a.gameId - b.gameId),
    };
  });
}
export function awardPercentage(units: number) {
  return `${(units / 10_000_000).toFixed(7)}%`;
}
