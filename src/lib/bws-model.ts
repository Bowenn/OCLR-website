import type { ProfileMode, ProfileSnapshot } from "./osu-profile-model";
export const badgeClassifications = [
  "unknown",
  "other",
  "osu",
  "taiko",
  "fruits",
  "mania",
] as const;
export type BadgeClassification = (typeof badgeClassifications)[number];
export function calculateBws(
  globalRank: unknown,
  eligibleBadges: unknown,
): number | null {
  if (
    typeof globalRank !== "number" ||
    !Number.isSafeInteger(globalRank) ||
    globalRank < 1 ||
    typeof eligibleBadges !== "number" ||
    !Number.isSafeInteger(eligibleBadges) ||
    eligibleBadges < 0
  )
    return null;
  return Math.pow(globalRank, Math.pow(0.9937, eligibleBadges ** 2));
}
/** Organizer formula: pp^(1.0063^(badges^2)/1). Never round stored results. */
export function calculateBadgeWeightedPp(
  pp: unknown,
  eligibleBadges: unknown,
): number | null {
  if (
    typeof pp !== "number" ||
    !Number.isFinite(pp) ||
    pp < 0 ||
    typeof eligibleBadges !== "number" ||
    !Number.isSafeInteger(eligibleBadges) ||
    eligibleBadges < 0
  )
    return null;
  if (pp === 0 || pp === 1) return pp;
  const exponent = Math.pow(1.0063, eligibleBadges ** 2) / 1;
  if (!Number.isFinite(exponent)) return null;
  const result = Math.pow(pp, exponent);
  return Number.isFinite(result) ? result : null;
}
export type BwsSummary = {
  mode: ProfileMode;
  status: "ready" | "stale" | "pending" | "unranked";
  value: number | null;
  rawPp: number | null;
  adjustedPp: number | null;
  ppStatus: "ready" | "stale" | "pending" | "unavailable";
  stale: boolean;
  badgeCount: number | null;
  globalRank: number | null;
  reviewedAt: string | null;
  fetchedAt: string;
};
export function summarizeBws(
  snapshot: ProfileSnapshot,
  classifications: BadgeClassification[] | null,
  reviewedAt: string | null = null,
): BwsSummary {
  const p = snapshot.profile;
  const badges = p.badges;
  const count =
    badges?.length === 0
      ? 0
      : badges &&
          classifications?.length === badges.length &&
          !classifications.includes("unknown")
        ? classifications.filter((c) => c === "osu").length
        : null;
  const value = calculateBws(p.statistics.globalRank, count);
  const rawPp =
    typeof p.statistics.pp === "number" &&
    Number.isFinite(p.statistics.pp) &&
    p.statistics.pp >= 0
      ? p.statistics.pp
      : null;
  const adjustedPp =
    p.ruleset === "osu" ? calculateBadgeWeightedPp(rawPp, count) : null;
  const stale = Boolean(snapshot.stale || snapshot.notice);
  return {
    mode: p.ruleset,
    rawPp,
    adjustedPp,
    ppStatus:
      p.ruleset !== "osu" || rawPp === null
        ? "unavailable"
        : count === null
          ? "pending"
          : adjustedPp === null
            ? "unavailable"
            : stale
              ? "stale"
              : "ready",
    stale,
    status: !p.statistics.globalRank
      ? "unranked"
      : value === null
        ? "pending"
        : snapshot.stale || snapshot.notice
          ? "stale"
          : "ready",
    value,
    badgeCount: count,
    globalRank: p.statistics.globalRank,
    reviewedAt,
    fetchedAt: p.fetchedAt,
  };
}
