"use client";
import { ReadOnlyFields } from "./staff-read-only";
import { useAppTranslations } from "@/i18n/shared";

import { useState } from "react";
import { ConfirmMutation } from "./confirm-mutation";
export function TeamManager({
  slug,
  version,
  captains,
}: {
  slug: string;
  version: number;
  captains: {
    userId: number;
    username: string;
    name: string;
    capacity: number | null;
  }[];
}) {
  const tr = useAppTranslations();

  const [values, setValues] = useState(captains);

  return (
    <ReadOnlyFields>
      <section className="panel form-stack">
        <h2>{tr("Configure captain teams")}</h2>
        <p className="muted small">
          {tr(
            "Use approved team names. Roster capacity includes the captain; leave it blank when not confirmed. Public identities update on Save.",
          )}
        </p>
        {values.map((c, index) => (
          <fieldset key={c.userId}>
            <legend>
              {c.username} ({c.userId})
            </legend>
            <label className="field">
              <span>{tr("Approved team name")}</span>
              <input
                value={c.name}
                maxLength={80}
                onChange={(e) =>
                  setValues(
                    values.map((v, i) =>
                      i === index ? { ...v, name: e.target.value } : v,
                    ),
                  )
                }
              />
            </label>
            <label className="field spaced">
              <span>{tr("Roster capacity (optional)")}</span>
              <input
                type="number"
                min={1}
                max={256}
                value={c.capacity ?? ""}
                onChange={(e) =>
                  setValues(
                    values.map((v, i) =>
                      i === index
                        ? {
                            ...v,
                            capacity: e.target.value
                              ? Number(e.target.value)
                              : null,
                          }
                        : v,
                    ),
                  )
                }
              />
            </label>
          </fieldset>
        ))}
        <ConfirmMutation
          requireConfirmation={false}
          label={tr("Save team configuration")}
          title={tr("Save these team identities?")}
          description={tr(
            "This assigns exactly one team to each appointed captain. Rosters stay private until finalized and explicitly published.",
          )}
          url={`/api/admin/tournaments/${slug}/teams`}
          payload={{
            command: {
              action: "configure",
              teams: values.map((c) => ({
                captainId: c.userId,
                name: c.name,
                capacity: c.capacity,
              })),
            },
            expectedVersion: version,
            confirmed: true,
          }}
        />
      </section>
    </ReadOnlyFields>
  );
}
