"use client";
import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { FixtureWorkspace } from "@/lib/fixtures";
import { formatDate } from "@/lib/editions";
export function RefereeAssignment({
  slug,
  fixture,
  data,
}: {
  slug: string;
  fixture: FixtureWorkspace["fixtures"][number];
  data: FixtureWorkspace;
}) {
  const id = useId(),
    dialog = useRef<HTMLDialogElement>(null),
    router = useRouter();
  const [selected, setSelected] = useState(fixture.refereeIds);
  const [revision, setRevision] = useState(fixture.assignmentRevision);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  function reset() {
    setSelected(fixture.refereeIds);
    setRevision(fixture.assignmentRevision);
    setError("");
  }
  async function save() {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${slug}/matches/${fixture.id}/referees`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            expectedAssignmentRevision: revision,
            refereeIds: selected,
          }),
        },
      );
      if (!response.ok) {
        const result = await response.json();
        setError(result.error ?? "Assignments could not be saved.");
        router.refresh();
        return;
      }
      dialog.current?.close();
      router.refresh();
    } catch {
      setError("Connection interrupted. Reload assignments before retrying.");
    } finally {
      setPending(false);
    }
  }
  const names = [
    ...data.eligibleReferees,
    ...fixture.referees.filter(
      (r) => !data.eligibleReferees.some((u) => u.osuId === r.osuId),
    ),
  ];
  const conflicts = fixture.scheduledAt
    ? data.fixtures.filter(
        (f) =>
          f.id !== fixture.id &&
          f.status !== "cancelled" &&
          f.scheduledAt?.getTime() === fixture.scheduledAt?.getTime() &&
          f.refereeIds.some((userId) => selected.includes(userId)),
      )
    : [];
  return (
    <>
      <button
        type="button"
        className="secondary"
        onClick={() => {
          reset();
          setQuery("");
          dialog.current?.showModal();
        }}
      >
        Assign Referee
      </button>
      <dialog
        ref={dialog}
        aria-labelledby={`${id}-title`}
        onCancel={(e) => {
          if (pending) e.preventDefault();
        }}
      >
        <h2 id={`${id}-title`}>Referees · {fixture.label}</h2>
        <p className="muted small">
          {fixture.scheduledAt
            ? `${formatDate(fixture.scheduledAt, fixture.timeZone)} (${fixture.timeZone})`
            : "Match time TBA"}
        </p>
        <p className="small">
          Current:{" "}
          {fixture.referees.map((r) => r.username).join(", ") || "Unassigned"}
        </p>
        <label className="field">
          <span>Search referees</span>
          <input
            type="search"
            value={query}
            maxLength={100}
            onChange={(e) => setQuery(e.target.value)}
            disabled={pending}
          />
        </label>
        <ul
          className="referee-choices"
          tabIndex={0}
          aria-label="Eligible referee choices"
        >
          {names
            .filter(
              (u) =>
                u.username.toLowerCase().includes(query.toLowerCase()) ||
                String(u.osuId).includes(query.trim()),
            )
            .map((u) => {
              const eligible = data.eligibleReferees.some(
                (p) => p.osuId === u.osuId,
              );
              return (
                <li key={u.osuId}>
                  <label className="check-field">
                    <input
                      type="checkbox"
                      checked={selected.includes(u.osuId)}
                      disabled={
                        pending || (!eligible && !selected.includes(u.osuId))
                      }
                      onChange={(e) =>
                        setSelected(
                          e.target.checked
                            ? [...selected, u.osuId]
                            : selected.filter((n) => n !== u.osuId),
                        )
                      }
                    />
                    <span>
                      {u.username}{" "}
                      <small className="muted">
                        osu! ID {u.osuId}
                        {!eligible && " · Role no longer active"}
                      </small>
                    </span>
                  </label>
                </li>
              );
            })}
        </ul>
        {!names.length && (
          <p className="muted small">
            No eligible Referees. Grant an edition-scoped Referee role in Staff
            Management.
          </p>
        )}
        <p className="muted small">{selected.length} selected</p>
        {conflicts.length > 0 && (
          <p className="notice small">
            Also assigned at this exact time:{" "}
            {conflicts.map((f) => f.label).join(", ")}. Match duration and
            availability have not been assumed.
          </p>
        )}
        {error && (
          <p className="notice error-text" role="alert">
            {error}
          </p>
        )}
        <div className="actions">
          <button disabled={pending} onClick={save}>
            {pending ? "Saving…" : "Save assignments"}
          </button>
          <button
            className="secondary"
            disabled={pending}
            onClick={() => dialog.current?.close()}
          >
            Cancel
          </button>
          {error && (
            <button className="secondary" disabled={pending} onClick={reset}>
              Reload assignments
            </button>
          )}
        </div>
      </dialog>
    </>
  );
}
