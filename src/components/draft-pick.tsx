"use client";
import { useId, useRef, useState } from "react";
import type { DraftIdentity, DraftTeam } from "@/lib/draft-types";
export function DraftPick({
  slug,
  sessionId,
  revision,
  turnIndex,
  team,
  pool,
  staff,
  enabled,
  onFeedback,
}: {
  slug: string;
  sessionId: string;
  revision: number;
  turnIndex: number;
  team: DraftTeam;
  pool: DraftIdentity[];
  staff: boolean;
  enabled: boolean;
  onFeedback: (message: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const [committed, setCommitted] = useState(false);
  const request = useRef<{
    sessionId: string;
    expectedVersion: number;
    turnIndex: number;
    candidateId: number;
    idempotencyKey: string;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const id = useId();
  const player = pool.find((p) => p.osuId === Number(selected));
  function report(message: string) {
    setStatus(message);
    onFeedback(message);
  }
  async function submit() {
    if (!player) return;
    setPending(true);
    setStatus("");
    request.current ??= {
      sessionId,
      expectedVersion: revision,
      turnIndex,
      candidateId: player.osuId,
      idempotencyKey: crypto.randomUUID(),
    };
    try {
      const response = await fetch(`/api/tournaments/${slug}/draft/picks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.current),
      });
      const result = await response.json();
      if (!response.ok) {
        report(
          result.error ??
            "The pick was not accepted. Wait for the current snapshot.",
        );
        return;
      }
      setCommitted(true);
      report(
        result.corrected
          ? "This earlier pick was corrected. Follow the current snapshot."
          : `Pick committed to ${team.name}. Awaiting staff publication.`,
      );
      dialog.current?.close();
    } catch {
      report(
        "Connection interrupted. Retry the same confirmed pick to check its receipt; do not choose another player until the snapshot refreshes.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel form-stack" aria-label="Player selection">
      <h2>
        {staff
          ? `Select for Captain ${team.captain.username}`
          : "Your captain turn"}
      </h2>
      <p className="muted small">
        Receiving team: <strong>{team.name}</strong>. Picks are committed by the
        server and published separately by staff.
      </p>
      <label className="field">
        <span>Search eligible players</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={pending || committed}
        />
      </label>
      <label className="field">
        <span>Eligible player</span>
        <select
          aria-label="Eligible player"
          size={6}
          value={selected}
          disabled={!enabled || pending || committed}
          onChange={(e) => {
            setSelected(e.target.value);
            request.current = null;
            setStatus("");
          }}
        >
          <option value="" disabled>
            Choose a player
          </option>
          {pool
            .filter(
              (p) =>
                p.username.toLowerCase().includes(query.toLowerCase()) ||
                String(p.osuId).includes(query),
            )
            .map((p) => (
              <option key={p.osuId} value={p.osuId}>
                {p.username} ({p.osuId})
              </option>
            ))}
        </select>
      </label>
      <button
        disabled={!enabled || !player || pending || committed}
        onClick={() => dialog.current?.showModal()}
      >
        {staff ? `Select for Captain ${team.captain.username}` : "Confirm Pick"}
      </button>
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <h2 id={`${id}-title`}>
          Select {player?.username} for {team.name}?
        </h2>
        <p className="muted">
          {staff
            ? `You are recording this selection on behalf of Captain ${team.captain.username}.`
            : "You are confirming your own captain-turn selection."}{" "}
          It claims the current turn and is recorded in the draft history.
        </p>
        {status && (
          <p className="notice" role="alert">
            {status}
          </p>
        )}
        <div className="actions">
          <button disabled={pending} onClick={submit}>
            {pending ? "Submitting…" : "Commit pick"}
          </button>
          <button
            className="secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
        </div>
      </dialog>
    </section>
  );
}
