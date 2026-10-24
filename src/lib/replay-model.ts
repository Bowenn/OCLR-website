export const REPLAY_MAX_BYTES = 8 * 1024 * 1024;
export const REPLAY_ENTRY_LIMIT = 10;
export const REPLAY_STORAGE_MAX_BYTES = 1024 * 1024 * 1024;
export const REPLAY_STORAGE_MAX_FILES = 10000;
export type ReplaySummary = {
  format: "stable";
  version: number;
  beatmapMd5: string;
  playerName: string;
  mode: "osu" | "taiko" | "fruits" | "mania";
  mods: number;
};
