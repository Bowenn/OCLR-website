/** Official cover paths use beatmapSET IDs, never difficulty IDs. */
export function beatmapCoverUrl(setId: number | null | undefined) {
  return Number.isSafeInteger(setId) && setId! > 0
    ? `https://assets.ppy.sh/beatmaps/${setId}/covers/cover.jpg`
    : null;
}
