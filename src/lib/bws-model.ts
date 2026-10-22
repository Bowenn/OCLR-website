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
export type BwsSummary = {
  mode: ProfileMode;
  status: "ready" | "stale" | "pending" | "unranked";
  value: number | null;
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
  return {
    mode: p.ruleset,
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
