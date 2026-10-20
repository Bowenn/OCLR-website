import { createHash } from "node:crypto";
import { z } from "zod";
import { osuApi } from "./osu-api";
import { HttpError } from "./http";
import type { BeatmapSnapshot } from "./mappool-model";
const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const beatmap = z.object({
  id: positiveId,
  beatmapset_id: positiveId,
  version: z.string().trim().min(1).max(500),
  difficulty_rating: z.number().finite().nonnegative(),
  bpm: z.number().finite().nonnegative(),
  total_length: z.number().int().nonnegative(),
  beatmapset: z.object({
    title: z.string().trim().min(1).max(500),
    artist: z.string().trim().min(1).max(500),
    creator: z.string().trim().min(1).max(500),
  }),
});
// Per-process bounded cache. Preview and Save share the same verified snapshot.
const cache = new Map<
  number,
  { snapshot?: BeatmapSnapshot; error?: HttpError; expiresAt: number }
>();
const inFlight = new Map<number, Promise<BeatmapSnapshot>>();
function remember(
  id: number,
  value: { snapshot?: BeatmapSnapshot; error?: HttpError; expiresAt: number },
) {
  cache.delete(id);
  if (cache.size >= 200) cache.delete(cache.keys().next().value!);
  cache.set(id, value);
}
async function loadBeatmap(id: number): Promise<BeatmapSnapshot> {
  try {
    const parsed = beatmap.safeParse(await osuApi(`/beatmaps/${id}`));
    if (!parsed.success || parsed.data.id !== id)
      throw new HttpError(
        502,
        "osu! returned incomplete beatmap metadata. Saved records were preserved.",
      );
    const b = parsed.data;
    const fetchedAt = Date.now();
    const metadata = {
      setId: b.beatmapset_id,
      title: b.beatmapset.title,
      artist: b.beatmapset.artist,
      mapper: b.beatmapset.creator,
      difficulty: b.version,
      stars: b.difficulty_rating,
      bpm: b.bpm,
      duration: b.total_length,
    };
    const snapshot: BeatmapSnapshot = {
      beatmapId: id,
      fetchedAt: new Date(fetchedAt).toISOString(),
      metadata,
      fingerprint: createHash("sha256")
        .update(JSON.stringify({ beatmapId: id, metadata }))
        .digest("hex"),
    };
    remember(id, { snapshot, expiresAt: fetchedAt + 60000 });
    return snapshot;
  } catch (error) {
    if (error instanceof HttpError) {
      // Cool down failed lookups too; never turn stale data into a verified Save.
      remember(id, {
        error,
        expiresAt:
          Date.now() +
          (error.status === 404 || error.status === 429 ? 60000 : 10000),
      });
    }
    throw error;
  }
}
export async function fetchBeatmap(id: number): Promise<BeatmapSnapshot> {
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new HttpError(400, "Invalid beatmap ID.");
  const cached = cache.get(id);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.snapshot) return cached.snapshot;
    throw cached.error!;
  }
  const existing = inFlight.get(id);
  if (existing) return existing;
  if (inFlight.size >= 6)
    throw new HttpError(429, "osu! lookup is busy. Please retry shortly.");
  const pending = loadBeatmap(id);
  inFlight.set(id, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(id);
  }
}
