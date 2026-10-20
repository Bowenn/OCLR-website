"use client";
import Link from "next/link";
import { useState } from "react";
import type { MappoolWorkspace } from "@/lib/mappools";
import {
  categories,
  categoryNames,
  slotLabel,
  parseBeatmapId,
  type BeatmapSnapshot,
} from "@/lib/mappool-model";
import { ConfirmMutation } from "./confirm-mutation";
import { BeatmapDetails } from "./beatmap-details";
import { BeatmapPreview } from "./beatmap-preview";
type Pool = MappoolWorkspace["pools"][number];
type Entry = MappoolWorkspace["entries"][number];
type Round = MappoolWorkspace["rounds"][number];
type Change = { url: string };
function Save({
  change,
  label,
  description,
  payload,
  disabled = false,
}: {
  change: Change;
  label: string;
  description: string;
  payload: Record<string, unknown>;
  disabled?: boolean;
}) {
  return (
    <ConfirmMutation
      disabled={disabled}
      requireConfirmation={["pool_publish", "entry_remove"].includes(
        String(payload.action),
      )}
      label={label}
      title={label}
      description={description}
      url={change.url}
      payload={{ ...payload, confirmed: true }}
    />
  );
}
function RoundForm({
  change,
  stage,
  round,
}: {
  change: Change;
  stage: string;
  round?: Round;
}) {
  const [name, setName] = useState(round?.name ?? "");
  const [position, setPosition] = useState(String(round?.position ?? 1));
  return (
    <div className="form-stack">
      <label className="field">
        <span>Round name</span>
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder="Approved round label"
        />
      </label>
      <label className="field">
        <span>Round order</span>
        <input
          type="number"
          min={1}
          max={999}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
      </label>
      <Save
        change={change}
        label={round ? "Save round" : "Create round"}
        description={`${round ? "Update" : "Create"} ${name || "the round"} in ${stage === "group" ? "Group Stage" : "Knockout Stage"}.`}
        payload={
          round
            ? {
                action: "round_edit",
                roundId: round.id,
                expectedVersion: round.version,
                name,
                position: Number(position),
              }
            : {
                action: "round_create",
                stage,
                name,
                position: Number(position),
              }
        }
      />
    </div>
  );
}
function CreatePool({ change, roundId }: { change: Change; roundId: string }) {
  const [name, setName] = useState("");
  return (
    <div className="form-stack">
      <label className="field">
        <span>New pool name</span>
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Save
        change={change}
        label="Create draft pool"
        description={`Create the unpublished pool ${name || "(name required)"} in the selected round.`}
        payload={{ action: "pool_create", roundId, name }}
      />
    </div>
  );
}
function PoolSettings({ change, pool }: { change: Change; pool: Pool }) {
  const [name, setName] = useState(pool.name);
  const [fmMode, setFmMode] = useState<string>(pool.fmMode ?? "");
  const [fmRestrictions, setRestrictions] = useState(pool.fmRestrictions);
  return (
    <div className="form-stack">
      <label className="field">
        <span>Pool name</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label className="field">
        <span>FM policy</span>
        <select value={fmMode} onChange={(e) => setFmMode(e.target.value)}>
          <option value="">Disabled</option>
          <option value="free_mod">Free Mod</option>
          <option value="force_mod">Force Mod</option>
        </select>
      </label>
      <label className="field">
        <span>Approved FM restrictions</span>
        <textarea
          value={fmRestrictions}
          onChange={(e) => setRestrictions(e.target.value)}
          maxLength={2000}
        />
      </label>
      <Save
        change={change}
        label="Save pool settings"
        description="Save the selected FM interpretation and the approved restrictions. No mod rules are assumed."
        payload={{
          action: "pool_settings",
          poolId: pool.id,
          expectedVersion: pool.version,
          name,
          fmMode: fmMode || null,
          fmRestrictions,
        }}
      />
    </div>
  );
}
function EntryForm({
  change,
  pool,
  category,
  entry,
}: {
  change: Change;
  pool: Pool;
  category: string;
  entry?: Entry;
}) {
  const [beatmap, setBeatmap] = useState(entry ? String(entry.beatmapId) : "");
  const id = parseBeatmapId(beatmap);
  const [preview, setPreview] = useState<BeatmapSnapshot | null>(null);
  const [mod, setMod] = useState(entry?.category ?? category);
  const [position, setPosition] = useState(String(entry?.position ?? 1));
  return (
    <div className="form-stack">
      <label className="field">
        <span>Beatmap URL or ID</span>
        <input
          value={beatmap}
          onChange={(e) => {
            const next = e.target.value;
            if (parseBeatmapId(next) !== id) setPreview(null);
            setBeatmap(next);
          }}
          aria-invalid={Boolean(beatmap.trim() && !id)}
          autoComplete="off"
          maxLength={250}
        />
      </label>
      {beatmap.trim() && !id && (
        <p role="alert" className="notice error-text">
          Enter a numeric beatmap ID or an official osu! difficulty URL.
        </p>
      )}
      {id && (
        <BeatmapPreview
          key={id}
          id={id}
          url={`${change.url}/preview`}
          onReady={setPreview}
        />
      )}
      <label className="field">
        <span>Mod category</span>
        <select value={mod} onChange={(e) => setMod(e.target.value)}>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c} — {categoryNames[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Slot number</span>
        <input
          type="number"
          min={1}
          max={999}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
      </label>
      <Save
        change={change}
        label={entry ? "Save map slot" : "Add beatmap"}
        disabled={!id || preview?.beatmapId !== id}
        description={`Save beatmap ${beatmap || "(required)"} in ${slotLabel(mod, Number(position))}. Official metadata is verified again when saving. Provider errors preserve saved records.`}
        payload={{
          action: "entry_save",
          expectedMetadataFingerprint: preview?.fingerprint,
          poolId: pool.id,
          expectedVersion: pool.version,
          entryId: entry?.id ?? null,
          beatmap,
          category: mod,
          position: Number(position),
        }}
      />
    </div>
  );
}
function EntryEditor({
  change,
  pool,
  category,
  entry,
}: {
  change: Change;
  pool: Pool;
  category: string;
  entry: Entry;
}) {
  const [open, setOpen] = useState(false);
  return (
    <details onToggle={(e) => setOpen(e.currentTarget.open)}>
      <summary>
        Edit or replace {slotLabel(entry.category, entry.position)}
      </summary>
      {open && (
        <EntryForm
          change={change}
          pool={pool}
          category={category}
          entry={entry}
        />
      )}
    </details>
  );
}
export function MappoolEditor({
  slug,
  data,
}: {
  slug: string;
  data: MappoolWorkspace;
}) {
  const [stage, setStage] = useState("group");
  const [roundId, setRoundId] = useState("");
  const [poolId, setPoolId] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("NM");

  const rounds = data.rounds.filter((r) => r.stage === stage);
  const round = rounds.find((r) => r.id === roundId) ?? rounds[0];
  const pools = data.pools.filter((p) => p.roundId === round?.id);
  const pool = pools.find((p) => p.id === poolId) ?? pools[0];
  const entries = data.entries
    .filter((e) => e.poolId === pool?.id && e.category === category)
    .sort((a, b) => a.position - b.position);
  const change = { url: `/api/admin/tournaments/${slug}/mappools` };
  const editable = pool && !pool.publishedAt && !pool.lockedAt;
  return (
    <div className="stack">
      <div className="panel form-stack">
        <h2>Edition workspace</h2>
        <div className="filters">
          <label className="field">
            <span>Stage</span>
            <select
              value={stage}
              onChange={(e) => {
                setStage(e.target.value);
                setRoundId("");
                setPoolId("");
              }}
            >
              <option value="group">Group Stage</option>
              <option value="knockout">Knockout Stage</option>
            </select>
          </label>
          <label className="field">
            <span>Round</span>
            <select
              value={round?.id ?? ""}
              onChange={(e) => {
                setRoundId(e.target.value);
                setPoolId("");
              }}
            >
              {!round && <option value="">No rounds configured</option>}
              {rounds.map((r) => (
                <option value={r.id} key={r.id}>
                  {r.position}. {r.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Mappool</span>
            <select
              value={pool?.id ?? ""}
              onChange={(e) => setPoolId(e.target.value)}
            >
              {!pool && <option value="">No pools configured</option>}
              {pools.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.name}
                  {p.publishedAt ? " · Published" : " · Draft"}
                </option>
              ))}
            </select>
          </label>
        </div>
        <details>
          <summary>Create a round</summary>
          <RoundForm change={change} stage={stage} />
        </details>
        {round && (
          <>
            <details>
              <summary>Edit selected round</summary>
              <RoundForm
                key={`${round.id}-${round.version}`}
                change={change}
                stage={stage}
                round={round}
              />
            </details>
            <details>
              <summary>Create a mappool</summary>
              <CreatePool key={round.id} change={change} roundId={round.id} />
            </details>
          </>
        )}
      </div>
      {pool ? (
        <>
          <section className="panel form-stack">
            <div className="section-title">
              <h2>{pool.name}</h2>
              <span className="badge">
                {pool.publishedAt ? "Published" : "Draft"} · v{pool.version}
              </span>
            </div>
            {pool.lockedAt && (
              <p className="notice">
                This pool is referenced by a completed fixture. Map changes are
                locked; create a new pool for later matches.
              </p>
            )}
            <div className="actions">
              <Save
                change={change}
                label={pool.publishedAt ? "Unpublish pool" : "Publish pool"}
                description={
                  pool.publishedAt
                    ? "Hide this pool from public queries. Recorded revisions are retained."
                    : "Release this pool and its current maps publicly. Confirm that FM details and every map are approved."
                }
                payload={{
                  action: "pool_publish",
                  poolId: pool.id,
                  expectedVersion: pool.version,
                  published: !pool.publishedAt,
                }}
              />
              {pool.publishedAt && (
                <Link
                  className="button secondary"
                  href={`/tournaments/${slug}/mappools/${pool.id}`}
                >
                  View public pool ↗
                </Link>
              )}
            </div>
            {editable ? (
              <details>
                <summary>Pool name and FM policy</summary>
                <PoolSettings
                  key={`${pool.id}-${pool.version}`}
                  change={change}
                  pool={pool}
                />
              </details>
            ) : (
              <p className="muted">
                {pool.fmMode === "free_mod"
                  ? "Free Mod"
                  : pool.fmMode === "force_mod"
                    ? "Force Mod"
                    : "FM disabled"}
                {pool.fmRestrictions ? ` · ${pool.fmRestrictions}` : ""}
              </p>
            )}
          </section>
          <section className="panel">
            <h2>Map slots</h2>
            <div className="actions" role="group" aria-label="Mod categories">
              {categories.map((c) => (
                <button
                  key={c}
                  className="secondary"
                  aria-pressed={category === c}
                  onClick={() => setCategory(c)}
                >
                  {c} (
                  {
                    data.entries.filter(
                      (e) => e.poolId === pool.id && e.category === c,
                    ).length
                  }
                  )
                </button>
              ))}
            </div>
            <h3 className="spaced">
              {category} /{" "}
              {category === "FM" && pool.fmMode
                ? pool.fmMode === "free_mod"
                  ? "Free Mod"
                  : "Force Mod"
                : categoryNames[category]}
            </h3>
            {entries.map((entry, i) => (
              <article className="mappool-entry-controls" key={entry.id}>
                <BeatmapDetails
                  beatmapId={entry.beatmapId}
                  metadata={entry.metadata}
                  label={slotLabel(entry.category, entry.position)}
                />
                {editable && (
                  <>
                    <EntryEditor
                      key={`${entry.id}-${pool.version}`}
                      change={change}
                      pool={pool}
                      category={category}
                      entry={entry}
                    />
                    <div className="actions">
                      {i > 0 && (
                        <Save
                          change={change}
                          label={`Move ${slotLabel(entry.category, entry.position)} up`}
                          description="Reorder this category and renumber its slots. No maps are removed."
                          payload={{
                            action: "reorder",
                            poolId: pool.id,
                            expectedVersion: pool.version,
                            category,
                            entryIds: entries
                              .map((e) => e.id)
                              .map((id, j, ids) =>
                                j === i - 1
                                  ? ids[i]
                                  : j === i
                                    ? ids[i - 1]
                                    : id,
                              ),
                          }}
                        />
                      )}
                      <Save
                        change={change}
                        label={`Refresh ${slotLabel(entry.category, entry.position)} metadata`}
                        description="Refresh official metadata. Provider failures retain the saved map information."
                        payload={{
                          action: "entry_refresh",
                          poolId: pool.id,
                          expectedVersion: pool.version,
                          entryId: entry.id,
                        }}
                      />
                      <Save
                        change={change}
                        label={`Remove ${slotLabel(entry.category, entry.position)}`}
                        description="Remove this map slot from the draft pool. The previous revision remains in the audit history."
                        payload={{
                          action: "entry_remove",
                          poolId: pool.id,
                          expectedVersion: pool.version,
                          entryId: entry.id,
                        }}
                      />
                    </div>
                  </>
                )}
              </article>
            ))}
            {!entries.length && (
              <p className="notice spaced">No {category} slots configured.</p>
            )}
            {editable && (category !== "FM" || pool.fmMode) && (
              <details className="spaced">
                <summary>Add a {category} beatmap</summary>
                <EntryForm
                  key={`${pool.id}-${category}-${pool.version}`}
                  change={change}
                  pool={pool}
                  category={category}
                />
              </details>
            )}
            {category === "FM" && !pool.fmMode && (
              <p className="muted">
                Choose Free Mod or Force Mod in pool settings to enable FM.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="notice">
          Create a round and a draft pool to begin. No tournament rounds or mod
          restrictions are assumed.
        </p>
      )}
    </div>
  );
}
