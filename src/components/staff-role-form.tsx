"use client";
import { useState } from "react";
import { ConfirmMutation } from "./confirm-mutation";
export function StaffRoleForm({
  editions,
  scopes,
}: {
  editions: { slug: string; name: string }[];
  scopes: string[] | null;
}) {
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("mappooler");
  const [scope, setScope] = useState(scopes?.[0] ?? "");
  const [reason, setReason] = useState("");
  return (
    <div className="panel form-stack">
      <h2>Grant a role</h2>
      <p className="muted">
        Verify the numeric osu! ID out of band. The user must have signed in.
        Roles combine; captain appointments are separate.
      </p>
      <label className="field">
        <span>Verified osu! user ID</span>
        <input
          inputMode="numeric"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          maxLength={16}
        />
      </label>
      <label className="field">
        <span>Role</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="mappooler">Mappooler</option>
          <option value="referee">Referee</option>
          <option value="admin">Admin — full access within scope</option>
        </select>
      </label>
      <label className="field">
        <span>Scope</span>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {!scopes && <option value="">Global — all editions</option>}
          {editions
            .filter((e) => !scopes || scopes.includes(e.slug))
            .map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>Reason for grant</span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      </label>
      <ConfirmMutation
        label="Review role grant"
        title="Grant staff access?"
        description={`Grant ${role} to osu! ID ${userId || "(missing)"} for ${scope || "all editions"}. This change takes effect immediately.`}
        url="/api/admin/staff"
        payload={{
          action: "grant",
          userId: Number(userId),
          role,
          editionSlug: scope || null,
          reason,
          confirmed: true,
        }}
      />
    </div>
  );
}
export function RevokeRole({
  id,
  username,
  role,
  scope,
}: {
  id: string;
  username: string;
  role: string;
  scope: string | null;
}) {
  const [reason, setReason] = useState("");
  return (
    <div className="form-stack">
      <label className="field">
        <span>
          Revocation reason for {username} ({role}, {scope ?? "global"})
        </span>
        <input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={500}
        />
      </label>
      <ConfirmMutation
        label="Revoke role"
        title="Revoke staff access?"
        description={`Remove ${username}'s ${role} role for ${scope ?? "all editions"}. Other grants remain active. This applies to existing sessions on the next authorization check.`}
        url="/api/admin/staff"
        payload={{ action: "revoke", grantId: id, reason, confirmed: true }}
      />
    </div>
  );
}
