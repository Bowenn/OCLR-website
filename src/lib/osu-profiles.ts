import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { userProfileCache, users } from "@/db/schema";
import { osuApi } from "./osu-api";
import { HttpError } from "./http";
import {
  normalizeOsuProfile,
  parseOsuProfile,
  type ProfileMode,
  type ProfileSnapshot,
} from "./osu-profile-model";
export const PROFILE_TTL_MS = 30 * 60 * 1000;
export const PROFILE_CACHE_LIMIT = 1000;
const pending = new Map<string, Promise<ProfileSnapshot>>();
function saved(
  row: typeof userProfileCache.$inferSelect,
): ProfileSnapshot | null {
  return row.profile
    ? {
        profile: row.profile,
        stale: Date.now() - Date.parse(row.profile.fetchedAt) >= PROFILE_TTL_MS,
        notice: null,
      }
    : null;
}
function unavailable(status: number) {
  return new HttpError(
    status,
    status === 404
      ? "This osu! profile is unavailable or no longer public."
      : status === 429
        ? "Profile refresh is busy. Please retry in a few minutes."
        : "osu! profile information is temporarily unavailable. Please try again later.",
  );
}
async function load(
  osuId: number,
  mode: ProfileMode,
  refresh: boolean,
): Promise<ProfileSnapshot> {
  if (!process.env.DATABASE_URL) throw unavailable(503);
  const now = new Date();
  // Short global lock bounds the shared cache and claims work across Node processes.
  // Provider I/O happens outside the transaction. A token guards late responses.
  const claim = await db().transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(713026)`);
    const [row] = await tx
      .select()
      .from(userProfileCache)
      .where(
        and(eq(userProfileCache.osuId, osuId), eq(userProfileCache.mode, mode)),
      );
    const snapshot = row ? saved(row) : null;
    if (snapshot && !snapshot.stale && !refresh && !row.errorStatus)
      return { snapshot };
    if (row && row.retryAt > now) {
      if (row.errorStatus === 404) throw unavailable(404);
      if (snapshot)
        return {
          snapshot: {
            ...snapshot,
            stale: snapshot.stale || row.errorStatus !== null,
            notice:
              "Saved snapshot. A refresh is pending or temporarily unavailable.",
          },
        };
      throw unavailable(row.errorStatus ?? 429);
    }
    const token = randomUUID();
    if (!row) {
      // Evict oldest attempts, including negative lookups. At most 1,000 keys.
      await tx.execute(sql`DELETE FROM user_profile_cache WHERE (osu_id, mode) IN (
        SELECT osu_id, mode FROM user_profile_cache ORDER BY attempted_at DESC OFFSET ${PROFILE_CACHE_LIMIT - 1}
      )`);
    }
    await tx
      .insert(userProfileCache)
      .values({
        osuId,
        mode,
        attemptedAt: now,
        retryAt: new Date(now.getTime() + 60000),
        refreshToken: token,
      })
      .onConflictDoUpdate({
        target: [userProfileCache.osuId, userProfileCache.mode],
        set: {
          attemptedAt: now,
          retryAt: new Date(now.getTime() + 60000),
          refreshToken: token,
        },
      });
    return { token, snapshot };
  });
  if (!claim.token) return claim.snapshot!;
  try {
    const profile = normalizeOsuProfile(
      await osuApi(`/users/${osuId}/${mode}?key=id`),
      osuId,
      mode,
    );
    const committed = await db().transaction(async (tx) => {
      const rows = await tx
        .update(userProfileCache)
        .set({ profile, errorStatus: null, refreshToken: null })
        .where(
          and(
            eq(userProfileCache.osuId, osuId),
            eq(userProfileCache.mode, mode),
            eq(userProfileCache.refreshToken, claim.token!),
          ),
        )
        .returning();
      if (!rows.length) return false;
      // Update only an existing mutable identity; never create users/participation.
      // A slower request for another mode cannot overwrite a newer username.
      await tx
        .update(users)
        .set({ username: profile.username, updatedAt: new Date() })
        .where(and(eq(users.osuId, osuId), sql`${users.updatedAt} <= ${now}`));
      return true;
    });
    if (!committed) throw unavailable(429);
    return { profile, stale: false, notice: null };
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 502;
    await db()
      .update(userProfileCache)
      .set({
        errorStatus: status,
        refreshToken: null,
        retryAt: new Date(Date.now() + 5 * 60000),
      })
      .where(
        and(
          eq(userProfileCache.osuId, osuId),
          eq(userProfileCache.mode, mode),
          eq(userProfileCache.refreshToken, claim.token),
        ),
      );
    if (claim.snapshot && status !== 404)
      return {
        ...claim.snapshot,
        stale: true,
        notice:
          "osu! could not refresh this profile. Showing the last successful snapshot.",
      };
    throw unavailable(status);
  }
}
/** Credentials stay server-side. Callers must enforce participant/staff visibility. */
export async function getOsuUserProfile(
  osuId: number,
  mode: ProfileMode = "osu",
  options: { refresh?: boolean } = {},
): Promise<ProfileSnapshot> {
  parseOsuProfile(String(osuId), mode);
  const key = `${osuId}:${mode}`;
  const existing = pending.get(key);
  if (existing) return existing;
  if (pending.size >= 32) throw unavailable(429);
  const request = load(osuId, mode, options.refresh === true);
  pending.set(key, request);
  try {
    return await request;
  } finally {
    pending.delete(key);
  }
}
