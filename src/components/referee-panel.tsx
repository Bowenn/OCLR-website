"use client";
import Link from "next/link";
import { refereeMessage } from "@/i18n/referee";
import { useEffect, useId, useRef, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { RefereeWorkspace, RefereeCommand } from "@/lib/referee";
import {
  refereeOrderConflicts,
  resolveRefereeActor,
  type RefereeEvent,
} from "@/lib/referee-model";
import { RefereeCommands } from "./referee-commands";
import { RefereeReconciliation } from "./referee-reconciliation";
import { RefereePolicyEditor } from "./referee-policy-editor";
import styles from "./referee-panel.module.css";

type Action = RefereeCommand extends infer C
  ? C extends RefereeCommand
    ? Omit<C, "requestKey" | "expectedRevision" | "dependencyFingerprint">
    : never
  : never;
export function RefereePanel({
  data: initial,
  slug,
}: {
  data: RefereeWorkspace;
  slug: string;
}) {
  const tr = useAppTranslations();
  const controlId = useId();
  const [data, setData] = useState(initial);
  const [firstBan, setFirstBan] = useState(
    initial.session?.firstBanTeamId ?? "",
  );
  const [firstPick, setFirstPick] = useState(
    initial.session?.firstPickTeamId ?? "",
  );
  const [commandDraft, setCommandDraft] = useState(
    initial.session?.settings ?? initial.defaultSettings,
  );
  const [activeStage, setActiveStage] = useState("referee-preparation");
  useEffect(() => {
    const ids = ["referee-preparation", "referee-bp", "referee-post-match"];
    const updateStage = () => {
      const current = ids
        .filter(
          (id) =>
            (document.getElementById(id)?.getBoundingClientRect().top ??
              Infinity) <= 180,
        )
        .at(-1);
      const atEnd =
        window.scrollY + window.innerHeight >=
        document.documentElement.scrollHeight - 2;
      setActiveStage(atEnd ? ids[2] : (current ?? ids[0]));
    };
    updateStage();
    window.addEventListener("scroll", updateStage, { passive: true });
    return () => window.removeEventListener("scroll", updateStage);
  }, []);
  const [selected, setSelected] = useState("");
  const [category, setCategory] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const pending = useRef<RefereeCommand | null>(null);
  const endpoint = `/api/admin/tournaments/${slug}/matches/${data.fixture.id}/referee`;
  const teamName = (id: string | null, neutral = true) =>
    data.teams.find((t) => t.id === id)?.name ??
    refereeMessage(tr, neutral ? "Neutral tiebreaker" : "Not set");
  const dirtyOrder =
    firstBan !== (data.session?.firstBanTeamId ?? "") ||
    firstPick !== (data.session?.firstPickTeamId ?? "");
  const stale = Boolean(
    data.session &&
    data.session.dependencyFingerprint !== data.dependencyFingerprint,
  );
  const basis = data.session?.basis ?? {
    policy: data.policy,
    teamIds: data.teams.map((t) => t.id),
    maps: data.maps,
    series: data.series,
  };
  const conflicts = refereeOrderConflicts(
    {
      ...basis,
      orders: {
        firstBanTeamId: data.session?.firstBanTeamId ?? null,
        firstPickTeamId: data.session?.firstPickTeamId ?? null,
      },
      events: data.events,
    },
    { firstBanTeamId: firstBan || null, firstPickTeamId: firstPick || null },
  );
  const map = data.maps.find((m) => m.id === selected) ?? null;
  function accept(next: RefereeWorkspace) {
    setData(next);
    setCommandDraft(next.session?.settings ?? next.defaultSettings);
    setFirstBan(next.session?.firstBanTeamId ?? "");
    setFirstPick(next.session?.firstPickTeamId ?? "");
  }
  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok)
        throw new Error(
          body.error ?? "Unable to reload the referee workspace.",
        );
      accept(body);
      setNotice(tr("Reloaded saved referee state."));
    } catch (e) {
      setError(
        refereeMessage(
          tr,
          e instanceof Error
            ? e.message
            : "Unable to reload the referee workspace.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  async function send(action?: Action) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    const payload = action
      ? ({
          ...action,
          requestKey: crypto.randomUUID(),
          expectedRevision: data.session?.revision ?? 0,
          dependencyFingerprint: data.dependencyFingerprint,
        } as RefereeCommand)
      : pending.current;
    if (!payload) {
      setBusy(false);
      return;
    }
    pending.current = payload;
    try {
      const response = await fetch(endpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500) {
          pending.current = null;
          setUncertain(false);
        } else setUncertain(true);
        throw new Error(body.error ?? "Unable to save the referee action.");
      }
      accept(body.workspace);
      pending.current = null;
      setUncertain(false);
      setNotice(tr("Referee record saved."));
    } catch (e) {
      if (pending.current) setUncertain(true);
      setError(
        refereeMessage(
          tr,
          e instanceof Error ? e.message : "Unable to save the referee action.",
        ),
      );
    } finally {
      setBusy(false);
    }
  }
  const disabled = busy || uncertain || !data.canRecord;
  const state = data.projection;
  function historyDetail(event: RefereeEvent) {
    const p = event.payload;
    if (p.type === "order_set") {
      return `${tr("First Ban team")}: ${teamName(p.firstBanTeamId)} · ${tr("First Pick team")}: ${teamName(p.firstPickTeamId)}`;
    }
    if (p.type === "selection_recorded") {
      return `${tr("Step {number}", { number: p.stepIndex + 1 })} · ${p.kind.toUpperCase()} · ${tr("Selected by {team}", { team: teamName(p.teamId) })} · ${p.category} · ${p.beatmapId}`;
    }
    if (p.type === "settings_saved") {
      return `${tr("Room name")}: ${p.settings.roomName || tr("Not set")} · ${tr("Timer seconds")}: ${p.settings.timerSeconds ?? tr("Not set")} · ${tr("Start countdown seconds")}: ${p.settings.startSeconds ?? tr("Not set")}`;
    }
    if (p.type === "policy_configured") {
      return p.policy.steps
        .map((step, index) => `${index + 1}. ${step.kind.toUpperCase()}`)
        .join(" → ");
    }
    if (p.type === "dependencies_reconfirmed") return "";
    const pickId = p.type === "selection_voided" ? p.selectionId : p.pickId;
    const selection = state.selections.find((item) => item.id === pickId);
    if (!selection) return "";
    const step = `${tr("Step {number}", { number: selection.stepIndex + 1 })} · ${selection.category} · ${selection.beatmapId}`;
    if (p.type === "selection_voided") return step;
    const attemptId = p.type === "attempt_replayed" ? event.id : p.attemptId;
    const attempt = selection.attempts.find((item) => item.id === attemptId);
    const description = `${step} · ${tr("Attempt {number}", { number: attempt?.number ?? 1 })}`;
    if (p.type !== "attempt_resolved") return description;
    const outcome = (status: string, winner: string | null) =>
      `${refereeMessage(tr, status)}${winner ? ` · ${tr("Winner")}: ${teamName(winner)}` : ""}`;
    const previous = data.events
      .filter(
        (item) =>
          item.ordinal < event.ordinal &&
          item.payload.type === "attempt_resolved" &&
          item.payload.attemptId === p.attemptId,
      )
      .at(-1)?.payload;
    return `${description} · ${previous?.type === "attempt_resolved" ? `${outcome(previous.status, previous.winnerTeamId)} → ` : ""}${outcome(p.status, p.winnerTeamId)}`;
  }
  return (
    <div className={styles.workspace}>
      <nav className={styles.stageNav} aria-label={tr("Referee stages")}>
        {[
          { id: "referee-preparation", label: tr("Pre-match preparation") },
          { id: "referee-bp", label: tr("BP stage") },
          { id: "referee-post-match", label: tr("Post-match calculation") },
        ].map((stage, index) => (
          <a
            key={stage.id}
            href={`#${stage.id}`}
            aria-current={activeStage === stage.id ? "location" : undefined}
            onClick={() => setActiveStage(stage.id)}
          >
            <span className={styles.navNumber}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span>{stage.label}</span>
          </a>
        ))}
      </nav>
      <div className={styles.stageContent}>
        <div className="actions">
          <Link
            className="button secondary"
            href={`/admin/tournaments/${slug}/matches`}
          >
            {tr("My assigned matches")}
          </Link>
          <Link
            className="button secondary"
            href={`/admin/tournaments/${slug}/matches/${data.fixture.id}`}
          >
            {tr("Post-match review")}
          </Link>
          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={refresh}
          >
            {tr("Reload saved state")}
          </button>
        </div>

        <section
          id="referee-preparation"
          className={styles.stage}
          aria-labelledby="referee-preparation-title"
        >
          <header className={styles.stageHeading}>
            <span className={styles.stageNumber}>01</span>
            <h2 id="referee-preparation-title">
              {tr("Pre-match preparation")}
            </h2>
          </header>
          <RefereeCommands
            key={`preparation-${data.session?.revision ?? 0}`}
            stage="preparation"
            settings={data.session?.settings ?? data.defaultSettings}
            draft={commandDraft}
            onDraftChange={setCommandDraft}
            policy={data.policy?.commands ?? null}
            rules={data.rules}
            teams={data.teams}
            selectedMap={map}
            canRecord={data.canRecord && !stale && !uncertain}
            busy={busy}
            onSave={(settings) => send({ action: "save_settings", settings })}
          />
          {data.canConfigure && (
            <RefereePolicyEditor
              key={data.policyRevision}
              policy={data.policy}
              maps={data.maps}
              busy={busy || uncertain}
              onSave={(policy) =>
                send({
                  action: "configure_policy",
                  expectedPolicyRevision: data.policyRevision,
                  policy,
                })
              }
            />
          )}
        </section>
        <section
          id="referee-bp"
          className={styles.stage}
          aria-labelledby="referee-bp-title"
        >
          <header className={styles.stageHeading}>
            <span className={styles.stageNumber}>02</span>
            <h2 id="referee-bp-title">{tr("BP stage")}</h2>
          </header>
          <section className="panel form-stack" aria-labelledby="referee-score">
            <div className={styles.topline}>
              <div>
                <p className="eyebrow" id="referee-score">
                  {tr("Referee temporary score")}
                </p>
                <div className={styles.score}>
                  {data.teams
                    .map((t) => `${t.name} ${state.score[t.id] ?? 0}`)
                    .join(" — ") || tr("Teams not resolved")}
                </div>
              </div>
              <span className="badge">
                {state.complete
                  ? tr("Temporary series complete")
                  : tr("Private Staff workspace")}
              </span>
            </div>
            <p className="muted">
              {tr(
                "Copy commands into osu! yourself. Record actual play separately. Temporary scores do not publish results.",
              )}
            </p>
            {!data.canRecord && (
              <p className="notice">
                {tr("Read-only access. Referee records cannot be changed.")}
              </p>
            )}
            {data.readiness.length > 0 && (
              <ul className="notice">
                {data.readiness.map((message, i) => (
                  <li key={i}>{refereeMessage(tr, message)}</li>
                ))}
              </ul>
            )}
            {stale && (
              <button
                type="button"
                className="secondary"
                disabled={disabled || state.activeSelections.length > 0}
                onClick={() => send({ action: "reconfirm_dependencies" })}
              >
                {tr("Recheck fixture dependencies")}
              </button>
            )}
            <div className={styles.orders}>
              <label className="field" htmlFor={`${controlId}-first-ban`}>
                <span id={`${controlId}-first-ban-label`}>
                  {tr("First Ban team")}
                </span>
                <select
                  id={`${controlId}-first-ban`}
                  aria-labelledby={`${controlId}-first-ban-label`}
                  value={firstBan}
                  disabled={disabled || stale}
                  onChange={(e) => setFirstBan(e.target.value)}
                >
                  <option value="">{tr("Not set")}</option>
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field" htmlFor={`${controlId}-first-pick`}>
                <span id={`${controlId}-first-pick-label`}>
                  {tr("First Pick team")}
                </span>
                <select
                  id={`${controlId}-first-pick`}
                  aria-labelledby={`${controlId}-first-pick-label`}
                  value={firstPick}
                  disabled={disabled || stale}
                  onChange={(e) => setFirstPick(e.target.value)}
                >
                  <option value="">{tr("Not set")}</option>
                  {data.teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="actions">
              <button
                type="button"
                disabled={
                  disabled ||
                  stale ||
                  !dirtyOrder ||
                  !firstBan ||
                  !firstPick ||
                  conflicts.length > 0
                }
                onClick={() =>
                  send({
                    action: "set_order",
                    firstBanTeamId: firstBan,
                    firstPickTeamId: firstPick,
                  })
                }
              >
                {tr("Apply order")}
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy || !dirtyOrder}
                onClick={() => {
                  setFirstBan(data.session?.firstBanTeamId ?? "");
                  setFirstPick(data.session?.firstPickTeamId ?? "");
                }}
              >
                {tr("Discard unsaved order")}
              </button>
              <span className="small muted">
                {dirtyOrder
                  ? tr("Order preview — not saved")
                  : tr("Showing applied order")}
              </span>
            </div>
            {conflicts.length > 0 && (
              <p role="status">
                {tr("Withdraw conflicting steps in reverse order: {steps}", {
                  steps: conflicts.join(", "),
                })}
              </p>
            )}
            {data.policy && (
              <details>
                <summary>{tr("Preview Ban / Pick sequence")}</summary>
                <ol>
                  {data.policy.steps.map((step, index) => (
                    <li key={index}>
                      {step.kind.toUpperCase()} ·{" "}
                      {teamName(
                        resolveRefereeActor(
                          step.actor,
                          {
                            firstBanTeamId: firstBan || null,
                            firstPickTeamId: firstPick || null,
                          },
                          data.teams.map((t) => t.id),
                        ),
                        step.actor === "neutral",
                      )}
                      {step.kind === "tb"
                        ? ` · ${step.tiedAt}:${step.tiedAt}`
                        : ""}
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </section>
          <div aria-live="polite">
            {notice && <p className="notice">{notice}</p>}
            {error && (
              <p role="alert" className="notice">
                {error}
              </p>
            )}
            {uncertain && (
              <div className="panel form-stack">
                <p>
                  {tr(
                    "The save outcome is unknown. Retry the same request before making another change.",
                  )}
                </p>
                <button disabled={busy} onClick={() => send()}>
                  {tr("Retry same request")}
                </button>
              </div>
            )}
          </div>
          <div className={styles.columns}>
            <section
              className={styles.commands}
              aria-label={tr("Current commands")}
            >
              <RefereeCommands
                stage="play"
                draft={commandDraft}
                onDraftChange={setCommandDraft}
                key={data.session?.revision ?? 0}
                settings={data.session?.settings ?? data.defaultSettings}
                policy={data.policy?.commands ?? null}
                rules={data.rules}
                teams={data.teams}
                selectedMap={map}
                mapSelector={
                  <label className="field" htmlFor={`${controlId}-command-map`}>
                    <span id={`${controlId}-command-map-label`}>
                      {tr("Selected map")}
                    </span>
                    <select
                      id={`${controlId}-command-map`}
                      aria-labelledby={`${controlId}-command-map-label`}
                      value={selected}
                      onChange={(event) => setSelected(event.target.value)}
                    >
                      <option value="">{tr("Not set")}</option>
                      {data.maps.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.category}
                          {entry.position} · {entry.metadata.artist} —{" "}
                          {entry.metadata.title}
                        </option>
                      ))}
                    </select>
                  </label>
                }
                canRecord={data.canRecord && !stale && !uncertain}
                busy={busy}
                onSave={(settings) =>
                  send({ action: "save_settings", settings })
                }
              />
            </section>
            <section
              className={`panel ${styles.ledger}`}
              aria-labelledby="referee-records"
            >
              <h2 id="referee-records">{tr("Referee records")}</h2>
              {!state.activeSelections.length && (
                <p className="muted">{tr("No Ban or Pick recorded yet.")}</p>
              )}
              {state.activeSelections.map((s) => {
                const attempt = s.attempts.at(-1);
                const last = s.id === state.lastSelectionId;
                return (
                  <article key={s.id} className={styles.record}>
                    <h3>
                      {s.stepIndex + 1}. {s.kind.toUpperCase()} · {s.category}
                      {data.maps.find((m) => m.id === s.entryId)?.position ??
                        ""}
                    </h3>
                    <p>
                      {tr("Selected by {team}", { team: teamName(s.teamId) })} ·{" "}
                      {s.beatmapId}
                    </p>
                    {s.kind !== "ban" &&
                      basis.policy?.maxReplaysPerMap !== undefined && (
                        <p className="small muted">
                          {tr("Replays used: {used} / {limit}", {
                            used: s.attempts.length - 1,
                            limit: basis.policy.maxReplaysPerMap,
                          })}
                        </p>
                      )}
                    {s.attempts.map((a) => (
                      <p className="small" key={a.id}>
                        {tr("Attempt {number}", { number: a.number })} ·{" "}
                        {refereeMessage(tr, a.status)}
                        {a.winnerTeamId
                          ? ` · ${tr("Winner")}: ${teamName(a.winnerTeamId)}`
                          : ""}
                        {a.id !== attempt?.id
                          ? ` · ${tr("Superseded by replay")}`
                          : ""}
                      </p>
                    ))}
                    {last && attempt && (
                      <div className={styles.stack}>
                        <div className="actions">
                          {attempt.status === "pending" && (
                            <button
                              type="button"
                              className="secondary"
                              disabled={disabled || stale}
                              onClick={() =>
                                send({ action: "start_attempt", pickId: s.id })
                              }
                            >
                              {tr("Record actual start")}
                            </button>
                          )}
                          {data.teams.map((t) => (
                            <button
                              type="button"
                              key={t.id}
                              disabled={disabled || stale}
                              onClick={() =>
                                send({
                                  action: "resolve_attempt",
                                  pickId: s.id,
                                  status: "completed",
                                  winnerTeamId: t.id,
                                })
                              }
                            >
                              {tr("Record win: {team}", { team: t.name })}
                            </button>
                          ))}
                        </div>
                        <div className="actions">
                          <button
                            className="secondary"
                            disabled={disabled || stale}
                            onClick={() =>
                              send({
                                action: "resolve_attempt",
                                pickId: s.id,
                                status: "tied",
                                winnerTeamId: null,
                              })
                            }
                          >
                            {tr("Record tie")}
                          </button>
                          <button
                            className="secondary"
                            disabled={disabled || stale}
                            onClick={() =>
                              send({
                                action: "resolve_attempt",
                                pickId: s.id,
                                status: "aborted",
                                winnerTeamId: null,
                              })
                            }
                          >
                            {tr("Record abort")}
                          </button>
                          <button
                            className="secondary"
                            disabled={
                              disabled ||
                              stale ||
                              ["pending", "playing"].includes(attempt.status) ||
                              (basis.policy?.maxReplaysPerMap !== undefined &&
                                s.attempts.length - 1 >=
                                  basis.policy.maxReplaysPerMap)
                            }
                            onClick={() =>
                              send({ action: "replay_attempt", pickId: s.id })
                            }
                          >
                            {tr("Record replay")}
                          </button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
              <button
                className="secondary"
                disabled={disabled || !state.lastSelectionId}
                onClick={() => send({ action: "void_last" })}
              >
                {tr("Withdraw last Ban / Pick")}
              </button>
              <details>
                <summary>{tr("Full correction history")}</summary>
                <ol className={styles.history}>
                  {data.events.map((e) => (
                    <li key={e.id}>
                      <strong>
                        {e.ordinal}. {refereeMessage(tr, e.payload.type)}
                      </strong>
                      <p>{historyDetail(e)}</p>
                      <p className="small muted">
                        {e.actorId} ·{" "}
                        <time dateTime={e.createdAt}>{e.createdAt}</time>
                      </p>
                    </li>
                  ))}
                </ol>
              </details>
            </section>
            <section
              className={`panel ${styles.pool}`}
              aria-labelledby="referee-pool"
            >
              <h2 id="referee-pool">{tr("Round mappool")}</h2>
              <p className="muted">
                {tr(
                  "Selecting a map only prepares commands. Save Ban / Pick separately.",
                )}
              </p>
              <label className="field">
                <span>{tr("Category")}</span>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">{tr("All categories")}</option>
                  {Array.from(new Set(data.maps.map((m) => m.category))).map(
                    (c) => (
                      <option key={c}>{c}</option>
                    ),
                  )}
                </select>
              </label>
              <div className={styles.maplist}>
                {data.maps
                  .filter((m) => !category || m.category === category)
                  .map((m) => {
                    const used = state.activeSelections.find(
                      (s) => s.entryId === m.id,
                    );
                    return (
                      <button
                        type="button"
                        key={m.id}
                        aria-pressed={selected === m.id}
                        className={`secondary ${styles.map}`}
                        onClick={() => setSelected(m.id)}
                      >
                        <strong>
                          {m.category}
                          {m.position}
                        </strong>
                        <span>
                          {m.metadata.artist} — {m.metadata.title}
                        </span>
                        <span className="small">
                          [{m.metadata.difficulty}] · {m.beatmapId}
                        </span>
                        <span className="small">
                          {used ? used.kind.toUpperCase() : tr("Available")}
                        </span>
                      </button>
                    );
                  })}
              </div>
              <div className="form-stack">
                <p>
                  {state.nextStep
                    ? tr("Next: {action} · {team}", {
                        action: state.nextStep.kind.toUpperCase(),
                        team: teamName(
                          state.nextStep.teamId,
                          state.nextStep.actor === "neutral",
                        ),
                      })
                    : tr("No further configured step")}
                </p>
                {state.issues.map((message, i) => (
                  <p className="small muted" key={i}>
                    {refereeMessage(tr, message)}
                  </p>
                ))}
                <button
                  disabled={
                    disabled ||
                    stale ||
                    dirtyOrder ||
                    !map ||
                    state.issues.length > 0 ||
                    !state.nextStep ||
                    Boolean(
                      state.activeSelections.find((s) => s.entryId === map?.id),
                    )
                  }
                  onClick={() =>
                    map && send({ action: "record_selection", entryId: map.id })
                  }
                >
                  {tr("Record selected Ban / Pick")}
                </button>
              </div>
            </section>
          </div>
        </section>
        <section
          id="referee-post-match"
          className={styles.stage}
          aria-labelledby="referee-post-match-title"
        >
          <header className={styles.stageHeading}>
            <span className={styles.stageNumber}>03</span>
            <h2 id="referee-post-match-title">
              {tr("Post-match calculation")}
            </h2>
          </header>
          <RefereeReconciliation
            key={data.session?.revision ?? 0}
            slug={slug}
            fixtureId={data.fixture.id}
          />
        </section>
      </div>
    </div>
  );
}
