const validId = (id: number | null | undefined): id is number =>
  Number.isSafeInteger(id) && id! > 0;

// Official destinations: https://github.com/ppy/osu-api/wiki#osu-url-schema
// https://github.com/ppy/osu-web/blob/master/routes/web.php
// Never infer a set ID from a difficulty ID or a title.
export function beatmapLinks(
  beatmapId: number | null | undefined,
  setId: number | null | undefined,
) {
  return {
    web: validId(beatmapId)
      ? `https://osu.ppy.sh/beatmaps/${beatmapId}`
      : validId(setId)
        ? `https://osu.ppy.sh/beatmapsets/${setId}`
        : null,
    direct: validId(setId) ? `osu://dl/${setId}` : null,
    download: validId(setId)
      ? `https://osu.ppy.sh/beatmapsets/${setId}/download`
      : null,
  };
}
