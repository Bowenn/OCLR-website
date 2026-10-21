import type { BeatmapMetadata, MappoolCategory } from "@/lib/mappool-model";
import {
  formatBeatmapDuration,
  formatBeatmapNumber,
} from "@/lib/mappool-model";
import { BeatmapCover } from "./beatmap-cover";
export function BeatmapDetails({
  beatmapId,
  metadata: m,
  label,
  category,
  fetchedAt,
}: {
  beatmapId: number;
  metadata: BeatmapMetadata;
  label?: string;
  category?: MappoolCategory;
  fetchedAt?: string;
}) {
  return (
    <div className="beatmap-row">
      <BeatmapCover key={m.setId} setId={m.setId} />
      <div className="beatmap-copy">
        {label && <span className="badge">{label}</span>}
        <h3>
          <a
            className="text-link"
            href={`https://osu.ppy.sh/beatmaps/${beatmapId}`}
          >
            <span className="beatmap-artist">{m.artist} — </span>
            {m.title} ↗
          </a>
        </h3>
        <p className="muted small">
          {m.difficulty} · mapped by {m.mapper}
        </p>
        <p className="small beatmap-stats">
          <span>
            <strong>{formatBeatmapNumber(m.stars, 2)}</strong> ★ base
          </span>{" "}
          <span>{formatBeatmapNumber(m.bpm)} BPM</span>{" "}
          <span>{formatBeatmapDuration(m.duration)}</span>
        </p>
        {(m.ar !== undefined ||
          m.od !== undefined ||
          m.cs !== undefined ||
          m.hp !== undefined) && (
          <p className="small muted beatmap-parameters">
            Base AR {formatBeatmapNumber(m.ar)} · OD {formatBeatmapNumber(m.od)}{" "}
            · CS {formatBeatmapNumber(m.cs)} · HP {formatBeatmapNumber(m.hp)}
          </p>
        )}
        {m.attributes ? (
          <div className="small beatmap-adjusted">
            <p>
              {m.attributes.configuration} ·{" "}
              {formatBeatmapNumber(m.attributes.stars, 2)} ★ official adjusted ·{" "}
              {m.attributes.ruleset}
              {m.attributes.maxCombo !== null
                ? ` · ${m.attributes.maxCombo} max combo`
                : ""}
            </p>
            {Object.keys(m.attributes.values).length > 0 && (
              <details>
                <summary>Official ruleset attributes</summary>
                <dl className="detail-list">
                  {Object.entries(m.attributes.values).map(([key, value]) => (
                    <div key={key}>
                      <dt>{key.replaceAll("_", " ")}</dt>
                      <dd>{Number(value.toFixed(3))}</dd>
                    </div>
                  ))}
                </dl>
              </details>
            )}
          </div>
        ) : (
          category &&
          category !== "NM" && (
            <p className="muted small beatmap-adjusted">
              Mod-adjusted difficulty:{" "}
              {category === "FM" || category === "TB"
                ? "Variable"
                : "Not calculated"}
              .
            </p>
          )
        )}
        {fetchedAt && (
          <p className="muted small">
            Official osu! API · Beatmap {beatmapId} / Set {m.setId} · Fetched{" "}
            <time dateTime={fetchedAt}>
              {new Date(fetchedAt).toISOString().replace("T", " ").slice(0, 19)}{" "}
              UTC
            </time>
          </p>
        )}
      </div>
    </div>
  );
}
