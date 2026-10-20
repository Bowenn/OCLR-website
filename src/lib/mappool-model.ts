export const categories = ["NM", "HD", "DT", "HR", "FM", "TB"] as const;
export const categoryNames = {
  NM: "No Mod",
  HD: "Hidden",
  DT: "Double Time",
  HR: "Hard Rock",
  FM: "FM",
  TB: "Tie Breaker",
};
export function slotLabel(category: string, position: number) {
  return category === "TB" && position === 1 ? "TB" : `${category}${position}`;
}

// Shared browser/server parsing: only fixed official difficulty URLs, never arbitrary fetch targets.
export function parseBeatmapId(input: string): number | null {
  const value = input.trim();
  if (value.length > 250) return null;
  const match = /^[1-9]\d*$/.test(value)
    ? [value, value]
    : (/^https:\/\/osu\.ppy\.sh\/(?:beatmaps|b)\/([1-9]\d*)\/?$/.exec(value) ??
      /^https:\/\/osu\.ppy\.sh\/beatmapsets\/[1-9]\d*\/?#(?:osu|taiko|fruits|mania)\/([1-9]\d*)$/.exec(
        value,
      ));
  const id = Number(match?.[1]);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}
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
export type BeatmapSnapshot = {
  beatmapId: number;
  metadata: BeatmapMetadata;
  fetchedAt: string;
  fingerprint: string;
};
