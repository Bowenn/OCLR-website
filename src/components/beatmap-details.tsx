import type { BeatmapMetadata } from "@/lib/mappool-model";
import { BeatmapCover } from "./beatmap-cover";
export function BeatmapDetails({
  beatmapId,
  metadata: m,
  label,
  fetchedAt,
}: {
  beatmapId: number;
  metadata: BeatmapMetadata;
  label?: string;
  fetchedAt?: string;
}) {
  return (
    <div className="beatmap-row">
      <BeatmapCover key={m.setId} setId={m.setId} />
      <div>
        {label && <span className="badge">{label}</span>}
        <h3>
          <a
            className="text-link"
            href={`https://osu.ppy.sh/beatmaps/${beatmapId}`}
          >
            {m.artist} — {m.title} ↗
          </a>
        </h3>
        <p className="muted small">
          {m.difficulty} · mapped by {m.mapper}
        </p>
        <p className="small">
          {m.stars.toFixed(2)} ★ base · {m.bpm} BPM ·{" "}
          {Math.floor(m.duration / 60)}:
          {String(m.duration % 60).padStart(2, "0")}
        </p>
        {(m.ar !== undefined ||
          m.od !== undefined ||
          m.cs !== undefined ||
          m.hp !== undefined) && (
          <p className="small muted">
            Base AR {m.ar ?? "—"} · OD {m.od ?? "—"} · CS {m.cs ?? "—"} · HP{" "}
            {m.hp ?? "—"}
          </p>
        )}
        {m.attributes ? (
          <div className="small">
            <p>
              {m.attributes.configuration} · {m.attributes.stars.toFixed(2)} ★
              official adjusted · {m.attributes.ruleset}
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
          label && (
            <p className="muted small">
              Mod-adjusted difficulty: variable / unconfigured.
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
