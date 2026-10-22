"use client";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import { profileModes, modeNames } from "@/lib/osu-profile-model";
import {
  badgeClassifications,
  type BadgeClassification,
} from "@/lib/bws-model";
import type { staffBws } from "@/lib/bws";
import { BwsSummary } from "./bws-summary";
export function BwsReview({ slug, id }: { slug: string; id: string }) {
  const tr = useAppTranslations();
  const [mode, setMode] = useState("");
  const [data, setData] = useState<Awaited<ReturnType<typeof staffBws>> | null>(
    null,
  );
  const [classifications, setClassifications] = useState<BadgeClassification[]>(
    [],
  );
  const [evidence, setEvidence] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  async function request(save = false) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${slug}/registrations/${id}/bws${save ? "" : `?mode=${mode}`}`,
        save
          ? {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                mode,
                fingerprint: data!.fingerprint,
                expectedVersion: data!.version,
                classifications,
                evidence,
                confirmed: true,
              }),
            }
          : undefined,
      );
      const result = await response.json();
      if (!response.ok) {
        setError(result.error);
        return;
      }
      setData(result);
      setClassifications(result.classifications);
      setEvidence("");
    } catch {
      setError("The action could not be completed.");
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="panel form-stack bws-review">
      <h2>{tr("Badge-weighted seeding")}</h2>
      <p className="small muted">
        {tr(
          "Select the competition ruleset explicitly. No tournament mode is inferred.",
        )}
      </p>
      <div className="actions">
        <label className="field">
          <span>{tr("Ruleset")}</span>
          <select
            value={mode}
            disabled={pending}
            onChange={(e) => {
              setMode(e.target.value);
              setData(null);
              setEvidence("");
              setError("");
            }}
          >
            <option value="">{tr("Select a ruleset for BWS.")}</option>
            {profileModes.map((m) => (
              <option key={m} value={m}>
                {modeNames[m]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          disabled={!mode || pending}
          onClick={() => request()}
        >
          {tr("Load BWS profile")}
        </button>
      </div>
      {data && (
        <>
          <BwsSummary value={data.summary} />
          {data.snapshot.profile.badges?.length ? (
            <>
              <p className="small muted">
                {tr(
                  "Classify only previous tournament prize badges in their actual ruleset. Contributor, mapper and contest awards are not tournament prizes.",
                )}
              </p>
              <ol className="badge-review-list">
                {data.snapshot.profile.badges.map((b, i) => (
                  <li key={i}>
                    <div>
                      <strong>{b.description}</strong>
                      <p className="muted small">{b.awardedAt}</p>
                      {b.url && (
                        <a
                          className="text-link"
                          href={b.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {tr("Badge source")}
                        </a>
                      )}
                    </div>
                    <label className="field">
                      <span>
                        {tr("Badge {number} classification", { number: i + 1 })}
                      </span>
                      <select
                        value={classifications[i]}
                        disabled={pending}
                        onChange={(e) =>
                          setClassifications(
                            classifications.map((c, j) =>
                              i === j
                                ? (e.target.value as BadgeClassification)
                                : c,
                            ),
                          )
                        }
                      >
                        {badgeClassifications.map((c) => (
                          <option key={c} value={c}>
                            {c === "unknown"
                              ? tr("Pending review")
                              : c === "other"
                                ? tr("Not a tournament prize")
                                : tr("Tournament prize — {mode}", {
                                    mode: modeNames[c],
                                  })}
                          </option>
                        ))}
                      </select>
                    </label>
                  </li>
                ))}
              </ol>
              <label className="field">
                <span>{tr("Badge classification evidence")}</span>
                <textarea
                  maxLength={2000}
                  value={evidence}
                  disabled={pending}
                  onChange={(e) => setEvidence(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={
                  pending ||
                  !evidence.trim() ||
                  data.snapshot.stale ||
                  !!data.snapshot.notice
                }
                onClick={() => request(true)}
              >
                {tr("Save badge review")}
              </button>
            </>
          ) : null}
        </>
      )}
      {error && (
        <p className="notice error-text" role="alert">
          {tr(error)}
        </p>
      )}
    </section>
  );
}
