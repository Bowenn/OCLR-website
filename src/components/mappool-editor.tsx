"use client";
import Link from "next/link";
import { WorkspaceTabs } from "./workspace-tabs";
import { useId, useState } from "react";
import type { MappoolWorkspace } from "@/lib/mappools";
import {
  categories,
  difficultyConfigurations,
  type DifficultyConfiguration,
  categoryNames,
  slotLabel,
  parseBeatmapId,
  type BeatmapSnapshot,
} from "@/lib/mappool-model";
import { ConfirmMutation } from "./confirm-mutation";
import { MappoolOrder } from "./mappool-order";
import { MappoolBatch } from "./mappool-batch";
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
  onSuccess,
}: {
  change: Change;
  label: string;
  description: string;
  payload: Record<string, unknown>;
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  return (
    <ConfirmMutation
      disabled={disabled}
      onSuccess={onSuccess}
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
  onSuccess,
  nextPosition,
}: {
  change: Change;
  stage: string;
  nextPosition: number;
  round?: Round;
  onSuccess: () => void;
}) {
  const [name, setName] = useState(round?.name ?? "");
  const [position, setPosition] = useState(
    String(round?.position ?? nextPosition),
  );
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
        onSuccess={onSuccess}
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
function CreatePool({
  change,
  roundId,
  onSuccess,
}: {
  change: Change;
  roundId: string;
  onSuccess: () => void;
}) {
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
        onSuccess={onSuccess}
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
  const [difficultyConfiguration, setDifficultyConfiguration] =
    useState<DifficultyConfiguration | null>(
      entry?.metadata.attributes?.configuration ?? null,
    );
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
      <label className="field">
        <span>Difficulty calculation mods</span>
        <select
          aria-label="Difficulty calculation mods"
          value={difficultyConfiguration ?? ""}
          onChange={(e) => {
            setPreview(null);
            setDifficultyConfiguration(
              (e.target.value as DifficultyConfiguration) || null,
            );
          }}
        >
          <option value="">Variable / unconfigured</option>
          {difficultyConfigurations.map((mods) => (
            <option key={mods} value={mods}>
              {mods}
              {mods.includes("DT")
                ? " · standard DT speed"
                : mods === "HT"
                  ? " · standard HT speed"
                  : ""}
            </option>
          ))}
        </select>
      </label>
      {id && (
        <BeatmapPreview
          key={`${id}-${difficultyConfiguration}`}
          difficultyConfiguration={difficultyConfiguration}
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
          difficultyConfiguration,
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
type Task = "maps" | "import" | "batch" | "settings";
type Setup = "round_create" | "round_edit" | "pool_create";
export function MappoolEditor({
  slug,
  data,
}: {
  slug: string;
  data: MappoolWorkspace;
}) {
  const id = useId();
  const [stage, setStage] = useState(data.rounds[0]?.stage ?? "group");
  const [roundId, setRoundId] = useState("");
  const [poolId, setPoolId] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("NM");
  const [task, setTask] = useState<Task>("maps");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [feedback, updateFeedback] = useState("");
  const [feedbackFailed, setFeedbackFailed] = useState(false);
  function setFeedback(message: string, failed = false) {
    updateFeedback(message);
    setFeedbackFailed(failed);
  }
  const rounds = data.rounds.filter((r) => r.stage === stage);
  const round = rounds.find((r) => r.id === roundId) ?? rounds[0];
  const pools = data.pools.filter((p) => p.roundId === round?.id);
  const pool = pools.find((p) => p.id === poolId) ?? pools[0];
  const poolEntries = data.entries.filter((e) => e.poolId === pool?.id);
  const entries = poolEntries
    .filter((e) => e.category === category)
    .sort((a, b) => a.position - b.position);
  const change = { url: `/api/admin/tournaments/${slug}/mappools` };
  const editable = Boolean(pool && !pool.publishedAt && !pool.lockedAt);
  const activeTask = editable ? task : "maps";
  function resetContext() {
    setTask("maps");
    setCategory("NM");
    setSetup(null);
    setFeedback("");
  }
  function toggleSetup(value: Setup) {
    setFeedback("");
    setSetup(setup === value ? null : value);
  }
  return (
    <div className="mappool-workbench">
      <div className="mappool-context">
        <div className="mappool-toolbar">
          <WorkspaceTabs
            id={`${id}-stage`}
            label="Competition stage"
            value={stage}
            items={[
              { value: "group", label: "Group Stage" },
              { value: "knockout", label: "Knockout Stage" },
            ]}
            onChange={(value) => {
              setStage(value);
              setRoundId("");
              setPoolId("");
              resetContext();
            }}
          />
          <button
            type="button"
            className="secondary"
            aria-expanded={setup === "round_create"}
            aria-controls={setup ? `${id}-setup` : undefined}
            onClick={() => toggleSetup("round_create")}
          >
            + New round
          </button>
        </div>
        <div
          role="tabpanel"
          id={`${id}-stage-panel`}
          aria-labelledby={`${id}-stage-${stage}`}
          tabIndex={0}
        >
          {rounds.length ? (
            <div className="mappool-round-bar">
              <div className="mappool-rounds" role="group" aria-label="Rounds">
                {rounds.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    aria-pressed={round?.id === r.id}
                    onClick={() => {
                      setRoundId(r.id);
                      setPoolId("");
                      resetContext();
                    }}
                  >
                    {r.name}
                  </button>
                ))}
              </div>
              <div className="actions">
                <button
                  type="button"
                  className="secondary"
                  aria-expanded={setup === "round_edit"}
                  aria-controls={setup ? `${id}-setup` : undefined}
                  onClick={() => toggleSetup("round_edit")}
                >
                  Edit round
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-expanded={setup === "pool_create"}
                  aria-controls={setup ? `${id}-setup` : undefined}
                  onClick={() => toggleSetup("pool_create")}
                >
                  + New pool
                </button>
              </div>
            </div>
          ) : (
            <p className="muted small mappool-empty">
              No rounds in this stage. Create a round to get started.
            </p>
          )}
          {pools.length > 1 && (
            <div className="mappool-pools" role="group" aria-label="Mappools">
              {pools.map((p) => (
                <button
                  type="button"
                  key={p.id}
                  aria-pressed={pool?.id === p.id}
                  onClick={() => {
                    setPoolId(p.id);
                    resetContext();
                  }}
                >
                  {p.name}
                  <span className="muted small">
                    {p.publishedAt ? "Published" : "Draft"}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
      {setup && (
        <section
          className="mappool-setup"
          id={`${id}-setup`}
          aria-labelledby={`${id}-setup-title`}
        >
          <div className="mappool-toolbar">
            <h2 id={`${id}-setup-title`}>
              {setup === "round_create"
                ? "Create a round"
                : setup === "round_edit"
                  ? "Edit selected round"
                  : "Create a mappool"}
            </h2>
            <button
              type="button"
              className="secondary"
              onClick={() => setSetup(null)}
            >
              Cancel
            </button>
          </div>
          {setup === "pool_create" && round ? (
            <CreatePool
              key={round.id}
              change={change}
              roundId={round.id}
              onSuccess={() => {
                setSetup(null);
                setFeedback(
                  "Pool created. Select it in this round to start editing.",
                );
              }}
            />
          ) : (
            <RoundForm
              key={`${setup}-${round?.id}-${round?.version}`}
              change={change}
              stage={stage}
              nextPosition={Math.max(0, ...rounds.map((r) => r.position)) + 1}
              round={setup === "round_edit" ? round : undefined}
              onSuccess={() => {
                setSetup(null);
                setFeedback("Round saved.");
              }}
            />
          )}
        </section>
      )}
      {feedback && (
        <div
          role={feedbackFailed ? "alert" : "status"}
          className={`mappool-feedback${feedbackFailed ? " is-error" : ""}`}
        >
          {feedback}
        </div>
      )}
      {pool ? (
        <section className="mappool-active" aria-label="Selected mappool">
          <div className="mappool-toolbar mappool-pool-heading">
            <div>
              <p className="muted small">
                {round?.name} · {poolEntries.length}{" "}
                {poolEntries.length === 1 ? "map" : "maps"}
              </p>
              <h2>
                {pool.name}{" "}
                <span className="badge">
                  {pool.publishedAt ? "Published" : "Draft"}
                </span>
              </h2>
            </div>
            <div className="actions">
              <Save
                change={change}
                label={pool.publishedAt ? "Unpublish pool" : "Publish pool"}
                description={
                  pool.publishedAt
                    ? "Hide this pool from public queries. History is retained."
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
                  className="text-link small"
                  href={`/tournaments/${slug}/mappools/${pool.id}`}
                >
                  View public pool ↗
                </Link>
              )}
            </div>
          </div>
          {pool.lockedAt ? (
            <p className="notice">
              This pool is referenced by a completed fixture. Map changes are
              locked; create a new pool for later matches.
            </p>
          ) : (
            pool.publishedAt && (
              <p className="muted small">
                Published pools are read-only. Unpublish this pool before
                editing.
              </p>
            )
          )}
          {!editable && (
            <p className="muted small">
              {pool.fmMode === "free_mod"
                ? "Free Mod"
                : pool.fmMode === "force_mod"
                  ? "Force Mod"
                  : "FM disabled"}
              {pool.fmRestrictions ? ` · ${pool.fmRestrictions}` : ""}
            </p>
          )}
          <WorkspaceTabs
            id={`${id}-task`}
            label="Pool tools"
            value={activeTask}
            onChange={(value) => {
              setTask(value);
              setFeedback("");
            }}
            items={
              editable
                ? [
                    { value: "maps", label: "Maps" },
                    { value: "import", label: "Bulk import" },
                    { value: "batch", label: "Batch edit" },
                    { value: "settings", label: "Pool settings" },
                  ]
                : [{ value: "maps", label: "Maps" }]
            }
          />
          <div
            className="mappool-task"
            role="tabpanel"
            id={`${id}-task-panel`}
            aria-labelledby={`${id}-task-${activeTask}`}
            tabIndex={0}
          >
            {activeTask === "maps" && (
              <>
                <h3 className="sr-only">Map slots</h3>
                <div
                  className="mappool-mods"
                  role="group"
                  aria-label="Mod categories"
                >
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
                {entries.length > 0 && (
                  <MappoolOrder
                    key={`${pool.id}-${category}`}
                    url={change.url}
                    pool={pool}
                    category={category}
                    entries={entries}
                    editable={editable}
                    onFeedback={setFeedback}
                    renderActions={(entry) => (
                      <>
                        <EntryEditor
                          key={`${entry.id}-${pool.version}`}
                          change={change}
                          pool={pool}
                          category={category}
                          entry={entry}
                        />
                        <div className="actions">
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
                            description="Remove this map slot from the draft pool. The previous map remains in the audit history."
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
                  />
                )}
                {!entries.length && (
                  <p className="notice spaced">
                    No {category} slots configured.
                  </p>
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
              </>
            )}
            {(activeTask === "import" || activeTask === "batch") && (
              <MappoolBatch
                key={`${pool.id}-${activeTask}`}
                url={change.url}
                pool={pool}
                entries={poolEntries}
                mode={activeTask}
                onFeedback={setFeedback}
              />
            )}
            {activeTask === "settings" && (
              <div className="mappool-settings">
                <h3>Pool name and FM policy</h3>
                <PoolSettings
                  key={`${pool.id}-${pool.version}`}
                  change={change}
                  pool={pool}
                />
              </div>
            )}
          </div>
        </section>
      ) : (
        round &&
        !setup && (
          <p className="muted small mappool-empty">
            No mappools in {round.name}. Create a draft pool to add beatmaps.
          </p>
        )
      )}
    </div>
  );
}
