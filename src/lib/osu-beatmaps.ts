import { z } from "zod";
import { osuApi } from "./osu-api";
import { HttpError } from "./http";
const positiveId = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export function parseBeatmapId(input: string) {
  let id = input.trim();
  if (!/^[1-9]\d*$/.test(id)) {
    let url: URL;
    try {
      url = new URL(id);
    } catch {
      throw new HttpError(
        400,
        "Enter an osu! beatmap ID or canonical beatmap URL.",
      );
    }
    if (
      url.origin !== "https://osu.ppy.sh" ||
      url.username ||
      url.password ||
      url.search
    )
      throw new HttpError(400, "Use an official osu! beatmap URL.");
    const match = /^\/(?:beatmaps|b)\/([1-9]\d*)\/?$/.exec(url.pathname);
    const set = /^\/beatmapsets\/[1-9]\d*\/?$/.test(url.pathname)
      ? /^#(?:osu|taiko|fruits|mania)\/([1-9]\d*)$/.exec(url.hash)
      : null;
    if (!match && !set)
      throw new HttpError(
        400,
        "Link to a specific beatmap difficulty, not only a beatmapset.",
      );
    if (match && url.hash)
      throw new HttpError(400, "Use a canonical beatmap URL.");
    id = (match ?? set)![1];
  }
  const parsed = positiveId.safeParse(Number(id));
  if (!parsed.success) throw new HttpError(400, "Invalid beatmap ID.");
  return parsed.data;
}
const beatmap = z.object({
  id: positiveId,
  beatmapset_id: positiveId,
  version: z.string().max(500),
  difficulty_rating: z.number().finite().nonnegative(),
  bpm: z.number().finite().nonnegative(),
  total_length: z.number().int().nonnegative(),
  beatmapset: z.object({
    title: z.string().max(500),
    artist: z.string().max(500),
    creator: z.string().max(500),
  }),
});
export type BeatmapMetadata = {
  setId: number;
  title: string;
  artist: string;
  difficulty: string;
  mapper: string;
  stars: number;
  bpm: number;
  duration: number;
};
const metadataCache = new Map<
  number,
  { data: BeatmapMetadata; fetchedAt: number }
>();
async function loadBeatmap(id: number): Promise<BeatmapMetadata> {
  const cached = metadataCache.get(id);
  if (cached && Date.now() - cached.fetchedAt < 60000) return cached.data;
  const parsed = beatmap.safeParse(await osuApi(`/beatmaps/${id}`));
  if (!parsed.success || parsed.data.id !== id)
    throw new HttpError(
      502,
      "osu! returned incomplete beatmap metadata. Saved records were preserved.",
    );
  const b = parsed.data;
  const data = {
    setId: b.beatmapset_id,
    title: b.beatmapset.title,
    artist: b.beatmapset.artist,
    mapper: b.beatmapset.creator,
    difficulty: b.version,
    stars: b.difficulty_rating,
    bpm: b.bpm,
    duration: b.total_length,
  };
  if (metadataCache.size >= 200)
    metadataCache.delete(metadataCache.keys().next().value!);
  metadataCache.set(id, { data, fetchedAt: Date.now() });
  return data;
}

const inFlight = new Map<number, Promise<BeatmapMetadata>>();
export async function fetchBeatmap(id: number): Promise<BeatmapMetadata> {
  const existing = inFlight.get(id);
  if (existing) return existing;
  const pending = loadBeatmap(id);
  inFlight.set(id, pending);
  try {
    return await pending;
  } finally {
    inFlight.delete(id);
  }
}
