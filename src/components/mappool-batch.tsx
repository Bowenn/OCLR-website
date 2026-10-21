"use client";
import { useEffect, useRef, useState } from "react";
import type { MappoolBatchPreview, MappoolWorkspace } from "@/lib/mappools";
import {
  categories,
  slotLabel,
  formatBeatmapDuration,
  formatBeatmapNumber,
  moveMappoolEntries,
  type MappoolCategory,
} from "@/lib/mappool-model";
import { ConfirmMutation } from "./confirm-mutation";
type Pool = MappoolWorkspace["pools"][number];
export function MappoolBatch({
  url,
  pool,
  entries,
  mode,
  onFeedback,
}: {
  mode: "import" | "batch";
  url: string;
  pool: Pool;
  entries: MappoolWorkspace["entries"];
  onFeedback: (message: string) => void;
}) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState<MappoolBatchPreview | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [category, setCategory] = useState<MappoolCategory>("NM"),
    [position, setPosition] = useState("1");
  const request = useRef<AbortController | null>(null);
  const [version, setVersion] = useState(pool.version);
  if (version !== pool.version) {
    setVersion(pool.version);
    setPreview(null);
    setSelected([]);
    setBusy(false);
  }
  useEffect(() => () => request.current?.abort(), [pool.version]);
  async function lookup() {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError("");
    setPreview(null);
    try {
      const response = await fetch(`${url}/preview`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          poolId: pool.id,
          expectedVersion: pool.version,
          text,
          category,
        }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Batch preview failed.");
      if (!controller.signal.aborted) setPreview(data);
    } catch (e) {
      if (!controller.signal.aborted)
        setError(e instanceof Error ? e.message : "Batch preview failed.");
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  const base = {
    poolId: pool.id,
    expectedVersion: pool.version,
    confirmed: true,
  };
  const ready =
    preview &&
    preview.version === pool.version &&
    preview.rows.length > 0 &&
    preview.rows.every((r) => !r.error && r.snapshot);
  let movePreview: typeof entries = [],
    moveError = "";
  if (selected.length) {
    try {
      movePreview = moveMappoolEntries(
        entries,
        entries.filter((e) => selected.includes(e.id)).map((e) => e.id),
        category,
        Number(position),
      );
    } catch (error) {
      moveError = (error as Error).message;
    }
  }
  return (
    <section className="mappool-batch">
      {mode === "import" && (
        <div className="form-stack">
          <h3>Import multiple beatmaps</h3>
          <p className="muted small">
            Paste up to 50 beatmap IDs or difficulty URLs in order. New slots
            append after the highest saved slot; existing maps are never
            replaced.
          </p>
          <label className="field">
            <span>Import category</span>
            <select
              aria-label="Import category"
              value={category}
              onChange={(event) => {
                request.current?.abort();
                setBusy(false);
                setPreview(null);
                setError("");
                setCategory(event.target.value as MappoolCategory);
              }}
            >
              {categories.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </label>
          <p className="muted small">
            Advanced: explicit slots such as NM1 4184799 or HD1 URL can be mixed
            with plain rows. Plain rows skip reserved explicit slots.
          </p>
          <label className="field">
            <span>Map rows</span>
            <textarea
              aria-label="Map rows"
              rows={6}
              maxLength={16000}
              value={text}
              placeholder={
                "4184799\nhttps://osu.ppy.sh/beatmaps/123\nhttps://osu.ppy.sh/beatmapsets/2010589#osu/4184800"
              }
              onChange={(e) => {
                request.current?.abort();
                setBusy(false);
                setPreview(null);
                setError("");
                setText(e.target.value);
              }}
            />
          </label>
          <div className="actions">
            <button
              type="button"
              disabled={busy || !text.trim()}
              onClick={lookup}
            >
              {busy ? "Looking up beatmaps…" : "Preview batch"}
            </button>
          </div>
          {error && (
            <p role="alert" className="notice error-text">
              {error}
            </p>
          )}
          <div role="status" aria-live="polite">
            {busy
              ? "Retrieving official metadata…"
              : preview
                ? `${preview.rows.filter((r) => !r.error).length} of ${preview.rows.length} rows ready.`
                : ""}
          </div>
          {preview && (
            <>
              <div
                className="table-scroll"
                role="region"
                aria-label="Batch preview"
                tabIndex={0}
              >
                <table>
                  <caption>Batch preview — {pool.name}</caption>
                  <thead>
                    <tr>
                      {[
                        "Row / slot",
                        "BID",
                        "Artist / title",
                        "Difficulty / mapper",
                        "Base SR",
                        "BPM / duration",
                        "Validation",
                      ].map((h) => (
                        <th key={h} scope="col">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.rows.map((r) => (
                      <tr key={r.line}>
                        <th scope="row">
                          {r.line} ·{" "}
                          {r.category && r.position
                            ? slotLabel(r.category, r.position)
                            : "—"}
                        </th>
                        <td>{r.beatmapId ?? "—"}</td>
                        <td>
                          {r.snapshot
                            ? `${r.snapshot.metadata.artist} — ${r.snapshot.metadata.title}`
                            : "—"}
                        </td>
                        <td>
                          {r.snapshot
                            ? `${r.snapshot.metadata.difficulty} · ${r.snapshot.metadata.mapper}`
                            : "—"}
                        </td>
                        <td>
                          {formatBeatmapNumber(r.snapshot?.metadata.stars, 2)}
                        </td>
                        <td>
                          {r.snapshot
                            ? `${formatBeatmapNumber(r.snapshot.metadata.bpm)} BPM · ${formatBeatmapDuration(r.snapshot.metadata.duration)}`
                            : "—"}
                        </td>
                        <td className={r.error ? "error-text" : ""}>
                          {r.error ?? r.warning ?? "Ready"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <ConfirmMutation
                requireConfirmation={false}
                label="Import verified batch"
                title="Import beatmaps"
                description="Save the verified rows atomically."
                url={url}
                disabled={!ready}
                onSuccess={() => {
                  setText("");
                  setPreview(null);
                  onFeedback("Beatmap batch imported.");
                }}
                onError={(message) =>
                  onFeedback(
                    `Batch was not saved. ${message} Preview the batch again.`,
                  )
                }
                payload={{
                  ...base,
                  action: "batch_import",
                  text,
                  category,
                  rows: preview.rows.map((r) => ({
                    category: r.category,
                    position: r.position,
                    beatmap: String(r.beatmapId),
                    expectedMetadataFingerprint: r.snapshot?.fingerprint,
                  })),
                }}
              />
            </>
          )}
        </div>
      )}
      {mode === "batch" &&
        (entries.length > 0 ? (
          <div className="form-stack">
            <h3>Manage multiple map slots</h3>
            <p className="muted small">
              Select up to 50 maps. Insert them at a position in the destination
              category; remaining maps shift and that category is renumbered.
            </p>
            <div className="table-scroll">
              <table>
                <caption>Saved map selection</caption>
                <thead>
                  <tr>
                    <th scope="col">Select</th>
                    <th scope="col">Slot</th>
                    <th scope="col">Beatmap</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <input
                          type="checkbox"
                          aria-label={`Select ${slotLabel(e.category, e.position)}`}
                          checked={selected.includes(e.id)}
                          onChange={(event) =>
                            setSelected(
                              event.target.checked
                                ? [...selected, e.id]
                                : selected.filter((id) => id !== e.id),
                            )
                          }
                        />
                      </td>
                      <th scope="row">{slotLabel(e.category, e.position)}</th>
                      <td>
                        {e.metadata.artist} — {e.metadata.title} [
                        {e.metadata.difficulty}] · {e.beatmapId}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="muted small">{selected.length} selected</p>
            <div className="filters">
              <label className="field">
                <span>Move to category</span>
                <select
                  aria-label="Move to category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as MappoolCategory)
                  }
                >
                  {categories.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Insert at position</span>
                <input
                  type="number"
                  min={1}
                  max={999}
                  value={position}
                  onChange={(e) => setPosition(e.target.value)}
                />
              </label>
            </div>
            {moveError && (
              <p className="error-text" role="status">
                {moveError}
              </p>
            )}
            {movePreview.length > 0 && (
              <details open>
                <summary>Preview destination order</summary>
                <ol className="mappool-move-preview">
                  {movePreview.map((e) => (
                    <li key={e.id}>
                      {slotLabel(e.category, e.position)} · {e.metadata.artist}{" "}
                      — {e.metadata.title} · {e.beatmapId}
                      {selected.includes(e.id) ? " (selected)" : ""}
                    </li>
                  ))}
                </ol>
              </details>
            )}
            <div className="actions">
              <ConfirmMutation
                requireConfirmation={false}
                label="Move / renumber selected"
                title="Move map slots"
                description="Insert the selected maps and renumber the destination category."
                url={url}
                disabled={
                  !selected.length || selected.length > 50 || !!moveError
                }
                payload={{
                  ...base,
                  action: "batch_move",
                  entryIds: entries
                    .filter((e) => selected.includes(e.id))
                    .map((e) => e.id),
                  category,
                  position: Number(position),
                }}
              />
              <ConfirmMutation
                requireConfirmation={false}
                label="Refresh selected metadata"
                title="Refresh metadata"
                description="Retrieve official metadata for every selected map; any failure leaves all saved maps unchanged."
                url={url}
                disabled={!selected.length || selected.length > 50}
                payload={{
                  ...base,
                  action: "batch_refresh",
                  entryIds: selected,
                }}
              />
              <ConfirmMutation
                label="Remove selected maps"
                title="Remove selected maps"
                description={`Remove ${selected.length} selected map slots? This cannot be undone in the editor. Historical audit records are retained.`}
                url={url}
                disabled={!selected.length || selected.length > 50}
                payload={{
                  ...base,
                  action: "batch_remove",
                  entryIds: selected,
                }}
              />
            </div>
          </div>
        ) : (
          <p className="muted small">
            No maps to select. Add beatmaps in Maps or Bulk import first.
          </p>
        ))}
    </section>
  );
}
