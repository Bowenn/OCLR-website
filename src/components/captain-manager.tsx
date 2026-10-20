"use client";
import { useRef, useState, type PointerEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CaptainPlayerCard, type CaptainIdentity } from "./captain-player-card";
import type { captainSetup } from "@/lib/captains";
import { ConfirmMutation } from "./confirm-mutation";
type Setup = Awaited<ReturnType<typeof captainSetup>>;
export function CaptainManager({
  slug,
  setup,
  identities = {},
}: {
  slug: string;
  setup: Setup;
  identities?: Record<number, CaptainIdentity>;
}) {
  const [action, setAction] = useState("publish");
  const [userId, setUserId] = useState("");
  const [previousUserId, setPrevious] = useState("");
  const [order, setOrder] = useState(setup.captains.map((c) => c.userId));
  const [search, setSearch] = useState("");
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [dragging, setDragging] = useState<number | null>(null);
  const dragged = useRef<number | null>(null);
  const router = useRouter();
  const [revision, setRevision] = useState(setup.version);
  // Sync authoritative order changes without losing conflict/error feedback.
  if (revision !== setup.version) {
    setRevision(setup.version);
    setOrder(setup.captains.map((c) => c.userId));
    setDragging(null);
  }
  const ordered = order.flatMap((id) =>
    setup.captains.filter((c) => c.userId === id),
  );
  const pool = setup.pool.filter((p) =>
    `${p.username} ${p.userId}`.toLowerCase().includes(search.toLowerCase()),
  );
  const changed = order.some((id, i) => id !== setup.captains[i]?.userId);
  const editable = !setup.locked && !pending;
  function move(id: number, target: number | undefined) {
    if (!editable) return;
    const destination =
      target === undefined ? order.length - 1 : order.indexOf(target);
    if (!order.includes(id) || destination < 0) return;
    const next = order.filter((value) => value !== id);
    next.splice(destination, 0, id);
    setOrder(next);
    setNotice("Captain order changed. Save the order to apply it.");
  }
  async function appoint(id: number) {
    if (!editable || !setup.pool.some((p) => p.userId === id)) return;
    if (changed) {
      setError(
        "Save or reset the captain order before appointing another captain.",
      );
      return;
    }
    await mutate({ action: "appoint", userId: id });
  }
  async function mutate(
    command:
      | { action: "appoint"; userId: number }
      | { action: "order"; userIds: number[] },
  ) {
    if (!editable) return;
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/admin/tournaments/${slug}/captains`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          command,
          expectedVersion: setup.version,
          confirmed: true,
        }),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error ?? "Captain setup could not be saved.");
      }
      setNotice(
        command.action === "appoint"
          ? "Captain appointed."
          : "Captain order saved.",
      );
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Appointment failed. Refresh to check the saved state.",
      );
      router.refresh();
    } finally {
      setPending(false);
    }
  }
  function drop(target?: number) {
    const id = dragged.current;
    dragged.current = null;
    setDragging(null);
    if (id === null || !editable) return;
    if (order.includes(id)) move(id, target);
    else void appoint(id);
  }
  function pointerStart(event: PointerEvent<HTMLElement>, id: number) {
    if (!editable || event.button !== 0) return;
    event.preventDefault();
    dragged.current = id;
    setDragging(id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerEnd(event: PointerEvent<HTMLElement>) {
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    const target = hit?.closest<HTMLElement>("[data-captain-id]");
    if (target) drop(Number(target.dataset.captainId));
    else if (hit?.closest("[data-captain-drop]")) drop();
    else {
      dragged.current = null;
      setDragging(null);
    }
  }
  const handle = (id: number) => (
    <span
      className="captain-drag-handle"
      aria-hidden="true"
      onPointerDown={(event) => pointerStart(event, id)}
      onPointerUp={pointerEnd}
      onPointerCancel={() => {
        dragged.current = null;
        setDragging(null);
      }}
    >
      ⠿
    </span>
  );

  const [unavailableExplanation, setExplanation] = useState("");
  const [published, setPublished] = useState(false);
  const [poolPublished, setPoolPublished] = useState(false);
  const command =
    action === "publish"
      ? { action, published, poolPublished }
      : action === "lock"
        ? { action }
        : action === "replace"
          ? {
              action,
              userId: Number(userId),
              previousUserId: Number(previousUserId),
            }
          : action === "availability"
            ? {
                action,
                userId: Number(userId),
                available: published,
                ...(!published ? { unavailableExplanation } : {}),
              }
            : { action, userId: Number(userId) };
  return (
    <div className="stack">
      {error && (
        <p className="notice error-text" role="alert">
          {error}
        </p>
      )}
      <p className="sr-only" role="status" aria-live="polite">
        {notice}
      </p>
      <div className="captain-board">
        <section
          className="panel form-stack"
          aria-labelledby="captain-order-heading"
        >
          <div className="section-title">
            <h2 id="captain-order-heading">Captains</h2>
            {setup.captains.length > 0 && (
              <Link
                className="text-link small"
                href={`/admin/tournaments/${slug}/teams`}
              >
                Configure teams →
              </Link>
            )}
          </div>
          <p className="muted small">
            {setup.locked
              ? "Captain setup is locked. Publication controls remain available below."
              : "Drag players here to appoint captains. Drag captains to reorder, then save the order. Move buttons also work with a keyboard."}
          </p>
          <div
            className={`captain-drop-zone${dragging !== null ? " is-dragging" : ""}`}
            data-captain-drop
            role="group"
            aria-label="Captain appointment area"
            onDragOver={(event) => {
              if (editable) event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              drop();
            }}
          >
            {ordered.length ? (
              <ol
                className="captain-order"
                aria-label="Captain selection order"
              >
                {ordered.map((c, index) => (
                  <li
                    key={c.userId}
                    data-captain-id={c.userId}
                    draggable={editable}
                    onDragStart={(event) => {
                      dragged.current = c.userId;
                      setDragging(c.userId);
                      event.dataTransfer.setData(
                        "text/plain",
                        String(c.userId),
                      );
                    }}
                    onDragEnd={() => {
                      dragged.current = null;
                      setDragging(null);
                    }}
                    onDragOver={(event) => {
                      if (editable) event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      drop(c.userId);
                    }}
                  >
                    {editable && handle(c.userId)}
                    <span className="captain-position">{index + 1}</span>
                    <CaptainPlayerCard
                      userId={c.userId}
                      username={c.username}
                      identity={identities[c.userId]}
                    />
                    <div className="captain-card-actions">
                      <div className="captain-move-actions">
                        <button
                          className="secondary"
                          type="button"
                          disabled={!editable || index === 0}
                          aria-label={`Move ${c.username} up`}
                          onClick={() => move(c.userId, order[index - 1])}
                        >
                          ↑
                        </button>
                        <button
                          className="secondary"
                          type="button"
                          disabled={!editable || index === order.length - 1}
                          aria-label={`Move ${c.username} down`}
                          onClick={() => move(c.userId, order[index + 1])}
                        >
                          ↓
                        </button>
                      </div>
                      <ConfirmMutation
                        label="Unappoint"
                        title={`Unappoint ${c.username}?`}
                        description={`Remove ${c.username}'s captain appointment and keep their registration.${c.teamId ? " Their empty captain team will be archived. Teams with other players or finalized rosters cannot be removed here." : ""}`}
                        disabled={!editable || changed}
                        url={`/api/admin/tournaments/${slug}/captains`}
                        payload={{
                          command: { action: "revoke", userId: c.userId },
                          expectedVersion: setup.version,
                          confirmed: true,
                        }}
                        onSuccess={() => {
                          setError("");
                          setNotice(`${c.username} is no longer a captain.`);
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted small">
                No captains appointed.
                {!setup.locked
                  ? " Drop a player card here or use Appoint captain below."
                  : ""}
              </p>
            )}
          </div>
          {changed && <p className="notice small">Unsaved captain order.</p>}
          {ordered.length > 0 && !setup.locked && (
            <div className="actions">
              <button
                type="button"
                className="secondary"
                disabled={!changed || pending}
                onClick={() => void mutate({ action: "order", userIds: order })}
              >
                {pending ? "Saving…" : "Save captain order"}
              </button>
              <button
                className="secondary"
                type="button"
                disabled={!changed || pending}
                onClick={() => {
                  setOrder(setup.captains.map((c) => c.userId));
                  setNotice("Captain order reset.");
                  setError("");
                }}
              >
                Reset order
              </button>
            </div>
          )}
        </section>
        <section
          className="panel form-stack"
          aria-labelledby="eligible-pool-heading"
        >
          <div className="section-title">
            <h2 id="eligible-pool-heading">Eligible remaining pool</h2>
            <span className="badge">
              {setup.pool.length}{" "}
              {setup.pool.length === 1 ? "player" : "players"}
            </span>
          </div>
          <label className="field">
            <span>Search players</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Username or osu! ID"
            />
          </label>
          {pool.length ? (
            <div className="captain-player-grid">
              {pool.map((p) => (
                <article
                  className="captain-player-card"
                  key={p.userId}
                  data-player-id={p.userId}
                  draggable={editable && !changed}
                  onDragStart={(event) => {
                    dragged.current = p.userId;
                    setDragging(p.userId);
                    event.dataTransfer.setData("text/plain", String(p.userId));
                  }}
                  onDragEnd={() => {
                    dragged.current = null;
                    setDragging(null);
                  }}
                >
                  {editable && !changed && handle(p.userId)}
                  <CaptainPlayerCard
                    userId={p.userId}
                    username={p.username}
                    identity={identities[p.userId]}
                  />
                  <button
                    className="secondary"
                    type="button"
                    disabled={!editable || changed}
                    aria-label={`Appoint ${p.username} as captain`}
                    onClick={() => void appoint(p.userId)}
                  >
                    Appoint captain
                  </button>
                </article>
              ))}
            </div>
          ) : (
            <p className="muted small">
              {search
                ? "No players match your search."
                : "No eligible players remain. Review accepted registrations to build the player pool."}
            </p>
          )}
        </section>
      </div>
      <details className="panel">
        <summary>Publication and advanced controls</summary>
        <div className="form-stack spaced">
          <h2>Captain and pool controls</h2>
          <label className="field">
            <span>Action</span>
            <select value={action} onChange={(e) => setAction(e.target.value)}>
              {["replace", "availability", "lock", "publish"].map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>
          {["replace", "availability"].includes(action) && (
            <label className="field">
              <span>Player</span>
              <select
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
              >
                <option value="">Choose an accepted player</option>
                {setup.candidates.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.username} ({c.userId})
                  </option>
                ))}
              </select>
            </label>
          )}
          {action === "replace" && (
            <label className="field">
              <span>Captain to replace</span>
              <select
                value={previousUserId}
                onChange={(e) => setPrevious(e.target.value)}
              >
                <option value="">Choose captain</option>
                {setup.captains.map((c) => (
                  <option key={c.userId} value={c.userId}>
                    {c.username}
                  </option>
                ))}
              </select>
            </label>
          )}
          {["publish", "availability"].includes(action) && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={published}
                onChange={(e) => setPublished(e.target.checked)}
              />
              <span>
                {action === "availability"
                  ? "Player is available for draft"
                  : "Publish approved captain identities and order"}
              </span>
            </label>
          )}
          {action === "publish" && (
            <label className="check-field">
              <input
                type="checkbox"
                checked={poolPublished}
                onChange={(e) => setPoolPublished(e.target.checked)}
              />
              <span>
                Approve public display of remaining eligible player identities
              </span>
            </label>
          )}

          {action === "availability" && !published && (
            <label className="field">
              <span>Draft unavailability explanation</span>
              <textarea
                value={unavailableExplanation}
                onChange={(e) => setExplanation(e.target.value)}
                maxLength={1000}
              />
            </label>
          )}
          <ConfirmMutation
            requireConfirmation={[
              "publish",
              "lock",
              "replace",
              "availability",
            ].includes(action)}
            disabled={
              pending || changed || (setup.locked && action !== "publish")
            }
            label="Review setup change"
            title="Apply this captain setup change?"
            description="Review player IDs and publication approval carefully. This change is audited and can affect draft eligibility."
            url={`/api/admin/tournaments/${slug}/captains`}
            payload={{
              command,
              expectedVersion: setup.version,
              confirmed: true,
            }}
          />
        </div>
      </details>
    </div>
  );
}
