"use client";
import { ReadOnlyFields } from "./staff-read-only";
import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import { ConfirmMutation } from "./confirm-mutation";
type EditableRoles = {
  userId: number;
  editionSlug: string | null;
  grants: { id: string; role: string }[];
};
const roleOptions = [
  ["mappooler", "Mappooler"],
  ["tester", "Tester"],
  ["replayer", "Replayer"],
  ["referee", "Referee"],
  ["streamer", "Streamer"],
  ["developer", "Developer — global read-only access"],
  ["admin", "Admin — full access within scope"],
] as const;
export function StaffRoleForm({
  editions,
  scopes,
  initialEdition = "",
  existing,
}: {
  editions: { slug: string; name: string }[];
  scopes: string[] | null;
  initialEdition?: string;
  existing?: EditableRoles;
}) {
  const tr = useAppTranslations();
  const [userId, setUserId] = useState(existing ? String(existing.userId) : "");
  const [selectedRoles, setSelectedRoles] = useState<string[]>(
    existing?.grants.map((g) => g.role) ?? ["mappooler"],
  );
  const [scope, setScope] = useState(
    existing
      ? (existing.editionSlug ?? "")
      : initialEdition || scopes?.[0] || "",
  );
  const unchanged =
    existing &&
    [...selectedRoles].sort().join(",") ===
      existing.grants
        .map((g) => g.role)
        .sort()
        .join(",");
  return (
    <ReadOnlyFields>
      <div className={existing ? "form-stack" : "panel form-stack"}>
        {!existing && <h2>{tr("Grant a role")}</h2>}
        {!existing && (
          <>
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
              <span>{tr("Scope")}</span>
              <select
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  if (e.target.value)
                    setSelectedRoles((roles) =>
                      roles.filter((role) => role !== "developer"),
                    );
                }}
              >
                {!scopes && (
                  <option value="">{tr("Global — all editions")}</option>
                )}
                {editions
                  .filter((e) => !scopes || scopes.includes(e.slug))
                  .map((e) => (
                    <option key={e.slug} value={e.slug}>
                      {e.name}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        <fieldset className="staff-role-options">
          <legend>{tr("Roles (select multiple)")}</legend>
          {roleOptions
            .filter(([role]) => role !== "developer" || (!scopes && !scope))
            .map(([role, label]) => (
              <label key={role}>
                <input
                  type="checkbox"
                  value={role}
                  checked={selectedRoles.includes(role)}
                  onChange={(e) =>
                    setSelectedRoles((current) =>
                      e.target.checked
                        ? [...current, role]
                        : current.filter((item) => item !== role),
                    )
                  }
                />
                <span>{tr(label)}</span>
              </label>
            ))}
        </fieldset>
        {selectedRoles.includes("developer") && (
          <p className="notice">
            {tr(
              "Developer can read private applications and unpublished editions. Other roles retain their existing write permissions and export access within scope.",
            )}
          </p>
        )}
        <ConfirmMutation
          label={existing ? tr("Save roles") : tr("Review role grant")}
          title={
            existing ? tr("Update staff roles?") : tr("Grant staff access?")
          }
          description={tr(
            "Set roles for osu! ID {userId} in {scope} to: {roles}. Other scopes and retained roles’ public visibility stay unchanged.",
            {
              userId,
              scope: scope || tr("Global"),
              roles: selectedRoles.join(", ") || tr("None"),
            },
          )}
          disabled={
            Boolean(unchanged) ||
            !/^[1-9]\d*$/.test(userId) ||
            (!existing && !selectedRoles.length)
          }
          url="/api/admin/staff"
          payload={{
            action: "set_roles",
            userId: Number(userId),
            roles: selectedRoles,
            editionSlug: scope || null,
            expectedGrantIds: existing?.grants.map((g) => g.id) ?? [],
            confirmed: true,
          }}
        />
      </div>
    </ReadOnlyFields>
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
