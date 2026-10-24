import { z } from "zod";
import type { ProfileSnapshot } from "./osu-profile-model";
const pp = z.number().finite().min(0).max(1000000).nullable();
const rank = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER).nullable();
export const eligibilityLimitsSchema = z
  .object({
    minPp: pp,
    maxPp: pp,
    minRank: rank,
    maxRank: rank,
  })
  .strict()
  .refine(
    (v) => v.minPp === null || v.maxPp === null || v.minPp <= v.maxPp,
    "Minimum PP must not exceed maximum PP.",
  )
  .refine(
    (v) => v.minRank === null || v.maxRank === null || v.minRank <= v.maxRank,
    "Minimum numeric rank must not exceed maximum numeric rank.",
  );
export type EligibilityLimits = z.infer<typeof eligibilityLimitsSchema>;
export const noEligibilityLimits: EligibilityLimits = {
  minPp: null,
  maxPp: null,
  minRank: null,
  maxRank: null,
};
export function hasEligibilityLimits(limits?: EligibilityLimits | null) {
  return !!limits && Object.values(limits).some((v) => v !== null);
}
export const ELIGIBILITY_FRESH_MS = 5 * 60 * 1000;
export type EligibilityVerification = {
  rankGraceRange?: { minRank: number; maxRank: number };
  userId: number;
  mode: "osu";
  source: "osu-api-v2";
  configurationVersion: number;
  status: "pass" | "fail" | "unavailable" | "staff_override";
  pp: number | null;
  rank: number | null;
  fetchedAt: string | null;
  checkedAt: string;
  limits: EligibilityLimits;
  comparisons: {
    field: keyof EligibilityLimits;
    limit: number;
    value: number | null;
    passed: boolean | null;
  }[];
};
export function evaluateEligibility(
  userId: number,
  configurationVersion: number,
  limits: EligibilityLimits,
  snapshot: ProfileSnapshot | null,
  now = Date.now(),
): EligibilityVerification {
  const p = snapshot?.profile;
  const fresh =
    !!p &&
    p.osuId === userId &&
    p.ruleset === "osu" &&
    !snapshot!.stale &&
    !snapshot!.notice &&
    Date.parse(p.fetchedAt) <= now &&
    now - Date.parse(p.fetchedAt) < ELIGIBILITY_FRESH_MS;
  const pp = p?.statistics.pp ?? null,
    rank = p?.statistics.globalRank ?? null;
  const comparisons = (
    Object.keys(limits) as (keyof EligibilityLimits)[]
  ).flatMap((field) => {
    const limit = limits[field];
    if (limit === null) return [];
    const value = field.endsWith("Pp") ? pp : rank;
    const valid =
      fresh &&
      value !== null &&
      Number.isFinite(value) &&
      value >= 0 &&
      (!field.endsWith("Rank") || (Number.isSafeInteger(value) && value > 0));
    return [
      {
        field,
        limit,
        value,
        passed: valid
          ? field.startsWith("min")
            ? value >= limit
            : value <= limit
          : null,
      },
    ];
  });
  return {
    userId,
    mode: "osu",
    source: "osu-api-v2",
    configurationVersion,
    status: comparisons.some((c) => c.passed === null)
      ? "unavailable"
      : comparisons.some((c) => !c.passed)
        ? "fail"
        : "pass",
    pp,
    rank,
    fetchedAt: p?.fetchedAt ?? null,
    checkedAt: new Date(now).toISOString(),
    limits,
    comparisons,
  };
}

/** An explicit organizer range allows rank-only failures to reach human review. */
export function withinRankGrace(
  value: EligibilityVerification,
  range?: { minRank: number; maxRank: number } | null,
) {
  return Boolean(
    range &&
    value.status === "fail" &&
    value.rank !== null &&
    Number.isSafeInteger(value.rank) &&
    value.rank >= range.minRank &&
    value.rank <= range.maxRank &&
    value.comparisons.some(
      (c) => c.field.endsWith("Rank") && c.passed === false,
    ) &&
    value.comparisons.every((c) =>
      c.field.endsWith("Rank") ? c.passed !== null : c.passed === true,
    ),
  );
}
