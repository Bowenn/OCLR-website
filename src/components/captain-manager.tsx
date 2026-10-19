"use client";
import { useState } from "react";
import type { captainSetup } from "@/lib/captains";
import { ConfirmMutation } from "./confirm-mutation";
type Setup = Awaited<ReturnType<typeof captainSetup>>;
export function CaptainManager({
  slug,
  setup,
}: {
  slug: string;
  setup: Setup;
}) {
  const [action, setAction] = useState("appoint");
  const [userId, setUserId] = useState("");
  const [previousUserId, setPrevious] = useState("");
  const [order, setOrder] = useState(
    setup.captains.map((c) => c.userId).join(", "),
  );
  const [reason, setReason] = useState("");
  const [published, setPublished] = useState(false);
  const [poolPublished, setPoolPublished] = useState(false);
  const command =
    action === "order"
      ? { action, userIds: order.split(",").map((v) => Number(v.trim())) }
      : action === "publish"
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
              ? { action, userId: Number(userId), available: published }
              : { action, userId: Number(userId) };
  return (
    <section className="panel form-stack">
      <h2>Captain and pool controls</h2>
      <p className="muted small">
        Changes require a reason and confirmation. Publication releases only
        approved osu! identity fields. Locked setup cannot be changed through
        normal controls.
      </p>
      <label className="field">
        <span>Action</span>
        <select value={action} onChange={(e) => setAction(e.target.value)}>
          {[
            "appoint",
            "replace",
            "revoke",
            "order",
            "availability",
            "lock",
            "publish",
          ].map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </label>
      {["appoint", "replace", "revoke", "availability"].includes(action) && (
        <label className="field">
          <span>Player</span>
          <select value={userId} onChange={(e) => setUserId(e.target.value)}>
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
      {action === "order" && (
        <label className="field">
          <span>Captain order (osu! IDs, comma-separated)</span>
          <input value={order} onChange={(e) => setOrder(e.target.value)} />
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
      <label className="field">
        <span>Reason / publication approval</span>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={1000}
          rows={2}
        />
      </label>
      <ConfirmMutation
        label="Review setup change"
        title="Apply this captain setup change?"
        description="Review player IDs and publication approval carefully. This change is audited and can affect draft eligibility."
        url={`/api/admin/tournaments/${slug}/captains`}
        payload={{
          command,
          expectedVersion: setup.version,
          reason,
          confirmed: true,
        }}
      />
    </section>
  );
}
