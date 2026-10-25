import { useAppTranslations } from "@/i18n/shared";
import { beatmapLinks } from "@/lib/beatmap-links";

/** Ordinary links: the browser/osu! handles sign-in and client handoff. */
export function BeatmapActions({
  beatmapId,
  setId,
  compact = false,
}: {
  beatmapId: number | null | undefined;
  setId: number | null | undefined;
  compact?: boolean;
}) {
  const tr = useAppTranslations();
  const links = beatmapLinks(beatmapId, setId);
  if (!links.web && !links.download)
    return <p className="muted small">{tr("Beatmap ID unresolved")}</p>;
  return (
    <div
      className={`beatmap-actions${compact ? " beatmap-actions-compact" : ""}`}
    >
      {links.web && (
        <a className="button secondary" href={links.web}>
          {tr("Open on osu!")}
        </a>
      )}
      {links.direct && (
        <a className="button secondary" href={links.direct}>
          {tr("osu!direct")}
        </a>
      )}
      {links.download && (
        <a className="button secondary" href={links.download}>
          {tr("Download")}
        </a>
      )}
    </div>
  );
}
