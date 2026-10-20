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
