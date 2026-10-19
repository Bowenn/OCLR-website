"use client";
import { useState } from "react";
import { ConfirmMutation } from "./confirm-mutation";
export function ReviewForm({
  id,
  updatedAt,
}: {
  id: string;
  updatedAt: string;
}) {
  const [status, setStatus] = useState<"accepted" | "rejected">("accepted");
  const [reason, setReason] = useState("");
  return (
    <section className="panel form-stack">
      <h2>Review application</h2>
      <label className="field">
        <span>Decision</span>
        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value as "accepted" | "rejected")
          }
        >
          <option value="accepted">Accept</option>
          <option value="rejected">Reject</option>
        </select>
      </label>
      <label className="field">
        <span>
          Explanation to player{" "}
          {status === "rejected" ? "(required)" : "(optional)"}
        </span>
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          maxLength={1000}
          rows={3}
        />
      </label>
      <p className="muted small">
        This explanation is visible to the player. Acceptance does not assign a
        team or captain role.
      </p>
      <ConfirmMutation
        label="Review decision"
        title={`${status === "accepted" ? "Accept" : "Reject"} this application?`}
        description="The player will see this decision and your explanation. The action is recorded in the staff audit trail."
        url={`/api/admin/registrations/${id}/review`}
        payload={{
          status,
          reason,
          expectedUpdatedAt: updatedAt,
          confirmed: true,
        }}
      />
    </section>
  );
}
