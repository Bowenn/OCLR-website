import type { Edition } from "./editions";
import { getOsuUserProfile } from "./osu-profiles";
import {
  evaluateEligibility,
  hasEligibilityLimits,
  noEligibilityLimits,
  ELIGIBILITY_FRESH_MS,
} from "./eligibility-model";
export async function verifyEligibility(
  userId: number,
  edition: Edition,
  revision: number,
) {
  const limits = edition.automaticEligibility ?? noEligibilityLimits;
  if (!hasEligibilityLimits(limits)) return null;
  let snapshot = null;
  try {
    snapshot = await getOsuUserProfile(userId, "osu");
    if (
      Date.now() - Date.parse(snapshot.profile.fetchedAt) >=
      ELIGIBILITY_FRESH_MS
    )
      snapshot = await getOsuUserProfile(userId, "osu", { refresh: true });
  } catch {
    /* Unavailable is an explicit result, never a fabricated pass. */
  }
  return evaluateEligibility(userId, revision, limits, snapshot);
}
