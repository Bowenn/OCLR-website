import { z } from "zod";
import type { User } from "./auth/sessions";
import { capabilityScope } from "./auth/staff";
import { publicPlayer } from "./players";
import { getOsuUserProfile } from "./osu-profiles";
import { parseOsuProfile } from "./osu-profile-model";
import { HttpError } from "./http";
export async function publishedPlayerProfile(input: string, mode?: string) {
  const identity = parseOsuProfile(input, mode);
  const participation = await publicPlayer(identity.osuId);
  if (!participation.length)
    throw new HttpError(404, "Published player not found.");
  let snapshot = null;
  let error = null;
  try {
    snapshot = await getOsuUserProfile(identity.osuId, identity.mode);
  } catch (e) {
    if (!(e instanceof HttpError)) throw e;
    error = { status: e.status, message: e.message };
  }
  // Check again after provider I/O: publication may have been withdrawn meanwhile.
  const current = await publicPlayer(identity.osuId);
  if (!current.length) throw new HttpError(404, "Published player not found.");
  return { identity, participation: current, snapshot, error };
}
const lookup = z
  .object({
    input: z.string().trim().min(1).max(300),
    mode: z.enum(["osu", "taiko", "fruits", "mania"]).optional(),
    refresh: z.boolean().default(false),
  })
  .strict();
export async function staffPlayerProfile(user: User, input: unknown) {
  // Operational lookup doesn't grant applicant, captain or draft access.
  await capabilityScope(user, "manage_registrations");
  const parsed = lookup.safeParse(input);
  if (!parsed.success)
    throw new HttpError(400, "Enter a valid profile ID or URL and ruleset.");
  const identity = parseOsuProfile(parsed.data.input, parsed.data.mode);
  return getOsuUserProfile(identity.osuId, identity.mode, {
    refresh: parsed.data.refresh,
  });
}
