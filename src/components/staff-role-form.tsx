"use client";
import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import { ConfirmMutation } from "./confirm-mutation";
export function StaffRoleForm({
  editions,
  scopes,
  initialEdition = "",
}: {
  editions: { slug: string; name: string }[];
  scopes: string[] | null;
  initialEdition?: string;
}) {
  const tr = useAppTranslations();

  const [userId, setUserId] = useState("");
  const [role, setRole] = useState("mappooler");
  const [scope, setScope] = useState(initialEdition || scopes?.[0] || "");

  return (
    <div className="panel form-stack">
      <h2>{tr("Grant a role")}</h2>
      <p className="muted">
        {tr(
          "The user must have signed in. Verify their osu! ID before granting access.",
        )}
      </p>
      <label className="field">
        <span>{tr("Verified osu! user ID")}</span>
        <input
          inputMode="numeric"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          maxLength={16}
        />
      </label>
      <label className="field">
        <span>{tr("Role")}</span>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="mappooler">{tr("Mappooler")}</option>
          <option value="referee">{tr("Referee")}</option>
          <option value="admin">
            {tr("Admin — full access within scope")}
          </option>
        </select>
      </label>
      <label className="field">
        <span>{tr("Scope")}</span>
        <select value={scope} onChange={(e) => setScope(e.target.value)}>
          {!scopes && <option value="">{tr("Global — all editions")}</option>}
          {editions
            .filter((e) => !scopes || scopes.includes(e.slug))
            .map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.name}
              </option>
            ))}
        </select>
      </label>
      <ConfirmMutation
        label={tr("Review role grant")}
        title={tr("Grant staff access?")}
        description={tr(
          "Grant {value0} to osu! ID {value1} for {value2}. This change takes effect immediately.",
          {
            value0: role,
            value1: userId || "(missing)",
            value2: scope || "all editions",
          },
        )}
        url="/api/admin/staff"
        payload={{
          action: "grant",
          userId: Number(userId),
          role,
          editionSlug: scope || null,
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
  const tr = useAppTranslations();

  return (
    <ConfirmMutation
      className="secondary role-revoke"
      label={tr("Revoke role")}
      title={tr("Revoke staff access?")}
      description={tr(
        "Remove {value0}'s {value1} role for {value2}. Other grants remain active. This applies to existing sessions on the next authorization check.",
        { value0: username, value1: role, value2: scope ?? "all editions" },
      )}
      url="/api/admin/staff"
      payload={{ action: "revoke", grantId: id, confirmed: true }}
    />
  );
}

export function StaffPublicVisibility({
  id,
  username,
  role,
  scope,
  published,
}: {
  id: string;
  username: string;
  role: string;
  scope: string | null;
  published: boolean;
}) {
  const tr = useAppTranslations();

  return (
    <ConfirmMutation
      label={published ? tr("Hide from About") : tr("Show on About")}
      title={tr("Show staff profile on About?")}
      description={tr(
        "Publish {value0}'s osu! username, avatar/profile link and {value1} role for {value2}. Edition-scoped roles appear only while that tournament is public. Other private grants stay hidden.",
        { value0: username, value1: role, value2: scope ?? "all editions" },
      )}
      url="/api/admin/staff"
      requireConfirmation={!published}
      payload={{
        action: "visibility",
        grantId: id,
        published: !published,
        expectedPublished: published,
        confirmed: true,
      }}
    />
  );
}
