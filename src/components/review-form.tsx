"use client";
import { ReadOnlyFields } from "./staff-read-only";
import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import { ConfirmMutation } from "./confirm-mutation";
export function ReviewForm({
  id,
  updatedAt,
}: {
  id: string;
  updatedAt: string;
}) {
  const tr = useAppTranslations();

  const [status, setStatus] = useState<"accepted" | "rejected">("accepted");
  const [reason, setReason] = useState("");
  return (
    <ReadOnlyFields>
      <section className="panel form-stack">
        <h2>{tr("Review application")}</h2>
        <label className="field">
          <span>{tr("Decision")}</span>
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as "accepted" | "rejected")
            }
          >
            <option value="accepted">{tr("Accept")}</option>
            <option value="rejected">{tr("Reject")}</option>
          </select>
        </label>
        <label className="field">
          <span>
            {tr("Explanation to player")}{" "}
            {status === "rejected" ? tr("(required)") : tr("(optional)")}
          </span>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={1000}
            rows={3}
          />
        </label>
        <p className="muted small">
          {tr(
            "This explanation is visible to the player. Acceptance does not assign a team or captain role.",
          )}
        </p>
        <ConfirmMutation
          label={tr("Review decision")}
          title={tr("{value0} this application?", {
            value0: status === "accepted" ? "Accept" : "Reject",
          })}
          description={tr(
            "The player will see this decision and your explanation. The action is recorded in the staff audit trail.",
          )}
          url={`/api/admin/registrations/${id}/review`}
          payload={{
            status,
            reason,
            expectedUpdatedAt: updatedAt,
            confirmed: true,
          }}
        />
      </section>
    </ReadOnlyFields>
  );
}
