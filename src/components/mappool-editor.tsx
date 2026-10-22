"use client";

import { useAppTranslations } from "@/i18n/shared";

import Link from "next/link";
import { WorkspaceTabs } from "./workspace-tabs";
import { useEffect, useId, useRef, useState } from "react";
import type { MappoolWorkspace } from "@/lib/mappools";
import {
  categories,
  difficultyConfigurations,
  type DifficultyConfiguration,
  categoryNames,
  fmModeNames,
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
  className,
  payload,
  disabled = false,
  onSuccess,
}: {
  change: Change;
  label: string;
  description?: string;
  className?: string;
  payload: Record<string, unknown>;
  disabled?: boolean;
  onSuccess?: () => void;
}) {
  return (
    <ConfirmMutation
      className={className}
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
  const tr = useAppTranslations();

  const [name, setName] = useState(round?.name ?? "");
  const [position, setPosition] = useState(
    String(round?.position ?? nextPosition),
  );
  return (
    <div className="form-stack">
      <label className="field">
        <span>{tr("Round name")}</span>
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
          placeholder={tr("Approved round label")}
        />
      </label>
      <div>
        <label className="field">
          <span>{tr("Round order")}</span>
          <input
            type="number"
            min={1}
            max={999}
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          />
        </label>
      </div>
      <Save
        change={change}
        onSuccess={onSuccess}
        label={round ? tr("Save round") : tr("Create round")}
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
  const tr = useAppTranslations();

  const [name, setName] = useState("");
  return (
    <div className="form-stack">
      <label className="field">
        <span>{tr("New pool name")}</span>
        <input
          value={name}
          maxLength={80}
          onChange={(e) => setName(e.target.value)}
        />
      </label>
      <Save
        change={change}
        label={tr("Create draft pool")}
        onSuccess={onSuccess}
        payload={{ action: "pool_create", roundId, name }}
      />
    </div>
  );
}
function PoolSettings({ change, pool }: { change: Change; pool: Pool }) {
  const tr = useAppTranslations();

  const [name, setName] = useState(pool.name);
  const [fmMode, setFmMode] = useState<string>(pool.fmMode ?? "");
  const [fmRestrictions, setRestrictions] = useState(pool.fmRestrictions);
  return (
    <div className="form-stack">
      <label className="field">
        <span>{tr("Pool name")}</span>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
        />
      </label>
      <label className="field">
        <span>{tr("FM policy")}</span>
        <select value={fmMode} onChange={(e) => setFmMode(e.target.value)}>
          <option value="">{tr("Disabled")}</option>
          <option value="free_mod">{fmModeNames.free_mod}</option>
          <option value="force_mod">{fmModeNames.force_mod}</option>
        </select>
      </label>
      {(fmMode || fmRestrictions) && (
        <label className="field">
          <span>{tr("Approved FM restrictions")}</span>
          <textarea
            value={fmRestrictions}
            onChange={(e) => setRestrictions(e.target.value)}
            maxLength={2000}
          />
        </label>
      )}
      <Save
        change={change}
        label={tr("Save pool settings")}
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
  entries = [],
  onSuccess,
}: {
  change: Change;
  pool: Pool;
  category: string;
  entry?: Entry;
  entries?: Entry[];
  onSuccess?: () => void;
}) {
  const tr = useAppTranslations();

  const [difficultyConfiguration, setDifficultyConfiguration] =
    useState<DifficultyConfiguration | null>(
      entry?.metadata.attributes?.configuration ?? null,
    );
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  const [beatmap, setBeatmap] = useState(entry ? String(entry.beatmapId) : "");
  const id = parseBeatmapId(beatmap);
  const [preview, setPreview] = useState<BeatmapSnapshot | null>(null);
  const [mod, setMod] = useState(entry?.category ?? category);
  function nextPosition(category: string) {
    return String(
      Math.max(
        0,
        ...entries
          .filter((e) => e.category === category)
          .map((e) => e.position),
      ) + 1,
    );
  }
  const [position, setPosition] = useState(
    String(entry?.position ?? nextPosition(category)),
  );
  return (
    <div className="form-stack">
      <label className="field">
        <span>{tr("Beatmap URL or ID")}</span>
        <input
          ref={input}
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
          {tr("Enter a numeric beatmap ID or an official osu! difficulty URL.")}
        </p>
      )}
      <fieldset className="mappool-attributes">
        <legend>{tr("Official mod attributes")}</legend>
        <label className="field">
          <span>{tr("Difficulty calculation mods")}</span>
          <select
            aria-label={tr("Difficulty calculation mods")}
            value={difficultyConfiguration ?? ""}
            onChange={(e) => {
              setPreview(null);
              setDifficultyConfiguration(
                (e.target.value as DifficultyConfiguration) || null,
              );
            }}
          >
            <option value="">{tr("Variable / unconfigured")}</option>
            {difficultyConfigurations.map((mods) => (
              <option key={mods} value={mods}>
                {mods}
                {mods.includes("DT")
                  ? tr(" · standard DT speed")
                  : mods === "HT"
                    ? tr(" · standard HT speed")
                    : ""}
              </option>
            ))}
          </select>
        </label>
      </fieldset>
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
        <span>{tr("Mod category")}</span>
        <select
          value={mod}
          onChange={(e) => {
            setMod(e.target.value);
            if (!entry) setPosition(nextPosition(e.target.value));
          }}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c} — {categoryNames[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>{tr("Slot number")}</span>
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
        label={entry ? tr("Save map slot") : tr("Add beatmap")}
        onSuccess={onSuccess}
        disabled={!id || preview?.beatmapId !== id}
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
  open,
  onOpen,
  onClose,
}: {
  change: Change;
  pool: Pool;
  category: string;
  entry: Entry;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const tr = useAppTranslations();
  const trigger = useRef<HTMLButtonElement>(null);
  const id = useId();
  const slot = slotLabel(entry.category, entry.position);
  function close() {
    onClose();
    requestAnimationFrame(() => trigger.current?.focus());
  }
  return (
    <>
      <div className="mappool-entry-action-row">
        <button
          type="button"
          className="secondary mappool-edit-action"
          ref={trigger}
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          onClick={() => (open ? close() : onOpen())}
        >
          {tr("Edit or replace {slot}", { slot })}
        </button>
        <Save
          change={change}
          label={tr("Refresh {slot} metadata", { slot })}
          payload={{
            action: "entry_refresh",
            poolId: pool.id,
            expectedVersion: pool.version,
            entryId: entry.id,
          }}
        />
        <Save
          change={change}
          className="secondary destructive-action"
          label={tr("Remove {slot}", { slot })}
          description={tr(
            "Remove this map slot. Published pools update immediately; history is retained.",
          )}
          payload={{
            action: "entry_remove",
            poolId: pool.id,
            expectedVersion: pool.version,
            entryId: entry.id,
          }}
          onSuccess={onClose}
        />
      </div>
      {open && (
        <section
          className="mappool-inline-editor"
          id={id}
          aria-label={tr("Edit or replace {slot}", { slot })}
        >
          <div className="mappool-inline-heading">
            <h4>{tr("Edit or replace {slot}", { slot })}</h4>
            <button type="button" className="secondary" onClick={close}>
              {tr("Cancel")}
            </button>
          </div>
          <EntryForm
            change={change}
            pool={pool}
            category={category}
            entry={entry}
            onSuccess={close}
          />
        </section>
      )}
    </>
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
  const tr = useAppTranslations();

  const id = useId();
  const [stage, setStage] = useState(data.rounds[0]?.stage ?? "group");
  const [roundId, setRoundId] = useState("");
  const [poolId, setPoolId] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("NM");
  const [task, setTask] = useState<Task>("maps");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [editingEntry, setEditingEntry] = useState<string | null>(null);
  const addButton = useRef<HTMLButtonElement>(null);
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
  const editable = Boolean(pool && !pool.lockedAt);
  const activeTask = editable ? task : "maps";
  function resetContext() {
    setTask("maps");
    setCategory("NM");
    setSetup(null);
    setEditingEntry(null);
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
            label={tr("Competition stage")}
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
            {tr("+ New round")}
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
              <div
                className="mappool-rounds"
                role="group"
                aria-label={tr("Rounds")}
              >
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
                  {tr("Edit round")}
                </button>
                <button
                  type="button"
                  className="secondary"
                  aria-expanded={setup === "pool_create"}
                  aria-controls={setup ? `${id}-setup` : undefined}
                  onClick={() => toggleSetup("pool_create")}
                >
                  {tr("+ New pool")}
                </button>
              </div>
            </div>
          ) : (
            <p className="muted small mappool-empty">
              {tr("No rounds in this stage. Create a round to get started.")}
            </p>
          )}
          {pools.length > 1 && (
            <div
              className="mappool-pools"
              role="group"
              aria-label={tr("Mappools")}
            >
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
                    {p.publishedAt ? tr("Published") : tr("Draft")}
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
                ? tr("Create a round")
                : setup === "round_edit"
                  ? tr("Edit selected round")
                  : tr("Create a mappool")}
            </h2>
            <button
              type="button"
              className="secondary"
              onClick={() => setSetup(null)}
            >
              {tr("Cancel")}
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
          {tr(feedback)}
        </div>
      )}
      {pool ? (
        <section className="mappool-active" aria-label={tr("Selected mappool")}>
          <div className="mappool-toolbar mappool-pool-heading">
            <div>
              <p className="muted small">
                {round?.name} · {poolEntries.length}{" "}
                {poolEntries.length === 1 ? tr("map") : tr("maps")}
              </p>
              <h2>
                {pool.name}{" "}
                <span className="badge">
                  {pool.publishedAt ? tr("Published") : tr("Draft")}
                </span>
              </h2>
              <p className="mappool-policy small muted">
                {pool.fmMode === "free_mod"
                  ? fmModeNames.free_mod
                  : pool.fmMode === "force_mod"
                    ? fmModeNames.force_mod
                    : tr("FM disabled")}
                {pool.fmRestrictions ? ` · ${pool.fmRestrictions}` : ""}
              </p>
            </div>
            <div className="actions mappool-pool-actions">
              {!pool.lockedAt && (
                <Save
                  change={change}
                  className={
                    pool.publishedAt
                      ? "secondary destructive-action"
                      : "secondary"
                  }
                  label={
                    pool.publishedAt ? tr("Unpublish pool") : tr("Publish pool")
                  }
                  description={
                    pool.publishedAt
                      ? tr(
                          "Hide this pool from public queries. History is retained.",
                        )
                      : tr(
                          "Release this pool and its current maps publicly. Confirm that FM details and every map are approved.",
                        )
                  }
                  payload={{
                    action: "pool_publish",
                    poolId: pool.id,
                    expectedVersion: pool.version,
                    published: !pool.publishedAt,
                  }}
                />
              )}
              {pool.publishedAt && (
                <Link
                  className="button secondary"
                  href={`/tournaments/${slug}/mappools/${pool.id}`}
                >
                  {tr("View public pool")}
                </Link>
              )}
            </div>
          </div>
          {pool.lockedAt ? (
            <p className="notice">
              {tr(
                "This pool is referenced by a completed fixture. Map changes are locked; create a new pool for later matches.",
              )}
            </p>
          ) : (
            pool.publishedAt && (
              <p className="muted small">
                {tr("Public changes appear on Save.")}
              </p>
            )
          )}
          <WorkspaceTabs
            id={`${id}-task`}
            label={tr("Pool tools")}
            value={activeTask}
            onChange={(value) => {
              setTask(value);
              setEditingEntry(null);
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
                <h3 className="sr-only">{tr("Map slots")}</h3>
                <div
                  className="mappool-mods"
                  role="group"
                  aria-label={tr("Mod categories")}
                >
                  {categories.map((c) => (
                    <button
                      key={c}
                      className="secondary"
                      aria-pressed={category === c}
                      data-empty={
                        poolEntries.every((e) => e.category !== c) || undefined
                      }
                      onClick={() => {
                        setCategory(c);
                        setEditingEntry(null);
                      }}
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
                      ? fmModeNames.free_mod
                      : fmModeNames.force_mod
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
                      <EntryEditor
                        key={`${entry.id}-${pool.version}`}
                        change={change}
                        pool={pool}
                        category={category}
                        entry={entry}
                        open={editingEntry === entry.id}
                        onOpen={() => setEditingEntry(entry.id)}
                        onClose={() => setEditingEntry(null)}
                      />
                    )}
                  />
                )}
                {!entries.length && (
                  <p className="notice spaced">
                    {tr("No ")}
                    {category} {tr(" slots configured.")}
                  </p>
                )}
                {editable && (category !== "FM" || pool.fmMode) && (
                  <div className="mappool-add-map">
                    <button
                      type="button"
                      className="secondary"
                      ref={addButton}
                      aria-expanded={editingEntry === "new"}
                      aria-label={tr("Add a {category} beatmap", { category })}
                      onClick={() =>
                        setEditingEntry(editingEntry === "new" ? null : "new")
                      }
                    >
                      {tr("Add beatmap")}
                    </button>
                    {editingEntry === "new" && (
                      <section
                        className="mappool-inline-editor"
                        aria-label={tr("Add beatmap")}
                      >
                        <div className="mappool-inline-heading">
                          <h4>
                            {tr("Add a {category} beatmap", { category })}
                          </h4>
                          <button
                            type="button"
                            className="secondary"
                            onClick={() => {
                              setEditingEntry(null);
                              addButton.current?.focus();
                            }}
                          >
                            {tr("Cancel")}
                          </button>
                        </div>
                        <EntryForm
                          key={`${pool.id}-${category}-${pool.version}`}
                          change={change}
                          pool={pool}
                          category={category}
                          entries={poolEntries}
                          onSuccess={() => {
                            setEditingEntry(null);
                            setFeedback("Map slot saved.");
                            requestAnimationFrame(() =>
                              addButton.current?.focus(),
                            );
                          }}
                        />
                      </section>
                    )}
                  </div>
                )}
                {category === "FM" && !pool.fmMode && (
                  <p className="muted">
                    {tr(
                      "Choose Free Mod or Force Mod in pool settings to enable FM.",
                    )}
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
                <h3>{tr("Pool name and FM policy")}</h3>
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
            {tr("No mappools in ")}
            {round.name}
            {tr(". Create a draft pool to add beatmaps.")}
          </p>
        )
      )}
    </div>
  );
}
