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

export type BulkRow = {
  line: number;
  category: (typeof categories)[number] | null;
  position: number | null;
  beatmapId: number | null;
  error: string | null;
  warning: string | null;
};
/** Plain-text rows only; a beatmapset without its difficulty is never guessed. */
export function parseMappoolRows(text: string): BulkRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((value, index) => ({ value: value.trim(), line: index + 1 }))
    .filter((row) => row.value);
  if (!lines.length || lines.length > 50 || text.length > 16000)
    throw new Error("Enter between 1 and 50 map rows.");
  const slots = new Set<string>(),
    entries = new Set<string>(),
    maps = new Set<number>();
  return lines.map(({ value, line }) => {
    const match = /^(NM|HD|DT|HR|FM|TB)([1-9]\d{0,2})?\s+(\S+)$/.exec(value);
    const category = (match?.[1] as BulkRow["category"]) ?? null;
    const position = match
      ? Number(match[2] ?? (category === "TB" ? 1 : NaN))
      : null;
    const beatmapId = match ? parseBeatmapId(match[3]) : null;
    let error =
      !category || !position || !beatmapId
        ? "Use SLOT BID or SLOT canonical difficulty URL (e.g. NM1 4184799)."
        : null;
    const slot = `${category}:${position}`,
      entry = `${category}:${beatmapId}`;
    if (!error && slots.has(slot)) error = "Duplicate slot in this batch.";
    if (!error && entries.has(entry))
      error = "Duplicate beatmap in the same category.";
    const warning =
      beatmapId && maps.has(beatmapId)
        ? "Beatmap reused; verify the intended mod categories."
        : null;
    slots.add(slot);
    entries.add(entry);
    if (beatmapId) maps.add(beatmapId);
    return { line, category, position, beatmapId, error, warning };
  });
}
