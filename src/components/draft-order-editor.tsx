"use client";
import { useState } from "react";
import type { StaffDraft } from "@/lib/draft";
import {
  detectDraftOrder,
  generateTurnSequence,
  maxDraftTurns,
  turnSequenceProblem,
  type DraftOrderMode,
} from "@/lib/draft-order";
import { ConfirmMutation } from "./confirm-mutation";
export function DraftOrderEditor({
  slug,
  data,
}: {
  slug: string;
  data: StaffDraft;
}) {
  const teamIds = data.teams.map((t) => t.team.id);
  const saved = data.session?.turnSequence ?? [];
  const [mode, setMode] = useState<DraftOrderMode | "">(() =>
    saved.length ? detectDraftOrder(teamIds, saved) : "",
  );
  const [custom, setCustom] = useState(saved);
  const capacities = data.teams.map((t) =>
    t.team.capacity === null ? null : t.team.capacity - 1,
  );
  const approvedRounds =
    capacities.length &&
    capacities.every((n) => n !== null && n === capacities[0] && n > 0)
      ? capacities[0]
      : null;
  const [rounds, setRounds] = useState(
    saved.length && teamIds.length && saved.length % teamIds.length === 0
      ? String(saved.length / teamIds.length)
      : approvedRounds
        ? String(approvedRounds)
        : "",
  );
  let sequence = custom,
    generationError = "";
  if (mode === "snake" || mode === "forward") {
    try {
      sequence = generateTurnSequence(teamIds, Number(rounds), mode);
    } catch (error) {
      sequence = [];
      generationError = (error as Error).message;
    }
  }
  const problem = !mode
    ? "Choose a pick order."
    : generationError ||
      turnSequenceProblem(
        sequence,
        data.teams.map(({ team }) => ({
          id: team.id,
          capacity: team.capacity,
          members: data.members.filter((m) => m.membership.teamId === team.id)
            .length,
        })),
        data.setupPoolSize ?? 0,
      );
  const sameSaved = JSON.stringify(sequence) === JSON.stringify(saved);
  const version = data.session?.version ?? 0;
  const url = `/api/admin/tournaments/${slug}/draft`;
  const groups = Array.from(
    { length: Math.ceil(sequence.length / Math.max(teamIds.length, 1)) },
    (_, i) => sequence.slice(i * teamIds.length, (i + 1) * teamIds.length),
  );
  return (
    <div className="draft-order-setup">
      <h3>Pick order</h3>
      <ol className="draft-captain-order" aria-label="Reviewed captain order">
        {data.teams.map(({ team, captainName }) => (
          <li key={team.id}>
            <strong>{team.name}</strong>
            <span className="muted small">
              Captain {captainName} ·{" "}
              {team.capacity === null
                ? "Capacity not configured"
                : `Capacity ${team.capacity}, including captain`}
            </span>
          </li>
        ))}
      </ol>
      <div className="draft-order-fields">
        <label className="field">
          <span>Order mode</span>
          <select
            value={mode}
            onChange={(e) => {
              const next = e.target.value as DraftOrderMode;
              if (next === "custom") setCustom(sequence);
              setMode(next);
            }}
          >
            <option value="" disabled>
              Choose a pattern
            </option>
            <option value="snake">Snake</option>
            <option value="forward">Repeat forward</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        {mode && mode !== "custom" && (
          <label className="field">
            <span>Pick rounds</span>
            <input
              type="number"
              min={1}
              max={Math.floor(maxDraftTurns / Math.max(teamIds.length, 1))}
              value={rounds}
              onChange={(e) => setRounds(e.target.value)}
            />
          </label>
        )}
      </div>
      {mode === "custom" && (
        <>
          <ol className="turn-editor">
            {custom.map((teamId, i) => (
              <li key={i}>
                <label className="field">
                  <span>Turn {i + 1}</span>
                  <select
                    value={teamId}
                    onChange={(e) =>
                      setCustom(
                        custom.map((id, n) => (n === i ? e.target.value : id)),
                      )
                    }
                  >
                    {data.teams.map(({ team, captainName }) => (
                      <option key={team.id} value={team.id}>
                        {team.name} — {captainName}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  className="secondary"
                  aria-label={`Remove turn ${i + 1}`}
                  onClick={() => setCustom(custom.filter((_, n) => n !== i))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
          <button
            className="secondary"
            disabled={
              !teamIds.length || custom.length + teamIds.length > maxDraftTurns
            }
            onClick={() => setCustom([...custom, ...teamIds])}
          >
            Append captain order
          </button>
        </>
      )}
      <div className="draft-order-summary">
        <h3>Sequence preview</h3>
        <span className="muted small">
          {sequence.length} picks · {data.setupPoolSize ?? 0} eligible players
        </span>
      </div>
      {sequence.length > 0 && (
        <div
          className="draft-order-preview"
          role="region"
          aria-label="Full turn sequence preview"
          tabIndex={0}
        >
          <ol>
            {groups.map((group, i) => (
              <li key={i}>
                <span className="muted small">
                  {mode === "custom"
                    ? `Turns ${i * teamIds.length + 1}–${i * teamIds.length + group.length}`
                    : `Round ${i + 1}`}
                </span>
                <ol>
                  {group.map((id, j) => {
                    const t = data.teams.find((t) => t.team.id === id);
                    return (
                      <li key={j}>
                        <span className="eyebrow">
                          {i * teamIds.length + j + 1}
                        </span>
                        <span>
                          {t?.team.name ?? "Unknown team"}
                          <small className="muted">{t?.captainName}</small>
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </li>
            ))}
          </ol>
        </div>
      )}
      {problem && (
        <p className="muted small" role="status">
          {problem}
        </p>
      )}
      {!data.edition?.lockedAt && (
        <p className="notice small">
          Lock the reviewed captain/team setup before saving the draft order.
        </p>
      )}
      <div className="actions">
        <ConfirmMutation
          requireConfirmation={false}
          label="Save turn sequence"
          title="Save turn sequence"
          description="Save the reviewed explicit sequence."
          disabled={Boolean(problem) || !data.edition?.lockedAt}
          url={url}
          payload={{
            expectedVersion: version,
            confirmed: true,
            command: {
              action: "configure",
              turnSequence: sequence,
              expectedSetupVersion: data.edition?.setupVersion ?? 0,
            },
          }}
        />
        {data.session && (
          <ConfirmMutation
            label="Freeze draft setup"
            title="Freeze draft setup?"
            description="Freeze the saved order and eligible player pool. Further configuration requires supervised recovery."
            disabled={!sameSaved || Boolean(problem) || !data.edition?.lockedAt}
            url={url}
            payload={{
              expectedVersion: version,
              confirmed: true,
              command: { action: "ready" },
            }}
          />
        )}
      </div>
      {!sameSaved && data.session && (
        <p className="muted small">Save these changes before freezing.</p>
      )}
    </div>
  );
}
