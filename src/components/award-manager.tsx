"use client";
import { useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { awardWorkspace } from "@/lib/awards";
import type { AwardWeek, AwardTier } from "@/lib/award-model";
import { ZonedDateInput } from "./zoned-date-input";
import { AwardPolicy } from "./award-policy";
import { AwardTable } from "./award-table";
type Data = Awaited<ReturnType<typeof awardWorkspace>>;
export function AwardManager({ initial }: { initial: Data }) {
  const tr = useAppTranslations();
  const [data, setData] = useState(initial),
    [weeks, setWeeks] = useState<AwardWeek[]>(initial.weeks),
    [tiers, setTiers] = useState<AwardTier[]>(initial.tiers);
  const [selected, setSelected] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const [validity, setValidity] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const dirty =
    JSON.stringify(weeks) !== JSON.stringify(data.weeks) ||
    JSON.stringify(tiers) !== JSON.stringify(data.tiers);
  async function send(command: Record<string, unknown>) {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(
        `/api/admin/tournaments/${data.edition.slug}/awards`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...command,
            expectedVersion: data.version,
            confirmed: true,
          }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Unable to save changes.");
      setData(result);
      setWeeks(result.weeks);
      setTiers(result.tiers);
      setNotice("Saved.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save changes.");
    } finally {
      setBusy(false);
    }
  }
  const report = data.reports.find((r) => r.number === selected),
    release = data.releases.find((r) => r.week === selected);
  return (
    <div className="form-stack">
      <AwardPolicy />
      {error && (
        <p role="alert" className="error-text">
          {tr(error)}
        </p>
      )}
      {notice && <p role="status">{tr(notice)}</p>}
      <details className="panel" open={!data.weeks.length}>
        <summary>{tr("Weeks and player Tiers")}</summary>
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            void send({ action: "configure", weeks, tiers });
          }}
        >
          <p className="muted small">{data.edition.timeZone}</p>
          {weeks.map((week, index) => (
            <fieldset key={week.number}>
              <legend>{tr("Week {value0}", { value0: week.number })}</legend>
              <div className="form-grid">
                {(["startsAt", "endsAt"] as const).map((key) => (
                  <ZonedDateInput
                    key={key}
                    label={key === "startsAt" ? tr("Starts") : tr("Ends")}
                    value={week[key] || null}
                    timeZone={data.edition.timeZone}
                    onChange={(value) =>
                      setWeeks((rows) =>
                        rows.map((r, i) =>
                          i === index ? { ...r, [key]: value ?? "" } : r,
                        ),
                      )
                    }
                    onValidityChange={(valid) =>
                      setValidity((state) =>
                        state[`${index}-${key}`] === valid
                          ? state
                          : { ...state, [`${index}-${key}`]: valid },
                      )
                    }
                  />
                ))}
              </div>
            </fieldset>
          ))}
          <div className="actions">
            <button
              type="button"
              className="secondary"
              disabled={busy || weeks.length >= 52}
              onClick={() =>
                setWeeks([
                  ...weeks,
                  { number: weeks.length + 1, startsAt: "", endsAt: "" },
                ])
              }
            >
              {tr("Add week")}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy || !weeks.length}
              onClick={() => {
                setWeeks(weeks.slice(0, -1));
                setValidity({});
              }}
            >
              {tr("Remove last week")}
            </button>
          </div>
          <label className="field">
            {tr("Search players")}
            <input value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>{tr("Player")}</th>
                  <th>{tr("Tier")}</th>
                </tr>
              </thead>
              <tbody>
                {data.participants
                  .filter((p) =>
                    `${p.username} ${p.userId}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                  )
                  .map((p) => (
                    <tr key={p.userId}>
                      <th>
                        {p.username}{" "}
                        <span className="muted small">{p.userId}</span>
                      </th>
                      <td>
                        <input
                          aria-label={`Tier: ${p.username}`}
                          type="number"
                          min={1}
                          max={99}
                          value={
                            tiers.find((t) => t.userId === p.userId)?.tier ?? ""
                          }
                          onChange={(e) =>
                            setTiers(
                              [
                                ...tiers.filter((t) => t.userId !== p.userId),
                                ...(e.target.value
                                  ? [
                                      {
                                        userId: p.userId,
                                        tier: Number(e.target.value),
                                      },
                                    ]
                                  : []),
                              ].sort((a, b) => a.userId - b.userId),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <button
            disabled={busy || !dirty || Object.values(validity).some((v) => !v)}
          >
            {tr("Save configuration")}
          </button>
        </form>
      </details>
      <section className="panel form-stack">
        <label className="field">
          {tr("Review week")}
          <select
            value={selected}
            onChange={(e) => setSelected(Number(e.target.value))}
          >
            {data.weeks.map((w) => (
              <option key={w.number} value={w.number}>
                {tr("Week {value0}", { value0: w.number })}
              </option>
            ))}
          </select>
        </label>
        {report ? (
          <>
            <p className="muted small">
              {release
                ? release.fingerprint === report.fingerprint
                  ? tr("Published")
                  : tr("Source changed; review required.")
                : tr("Draft")}
            </p>
            {report.issues.map((issue) => (
              <p role="alert" key={issue}>
                {issue}
              </p>
            ))}
            <details>
              <summary>{tr("Calculation sources")}</summary>
              <ul>
                {report.evidence.map((source) => (
                  <li key={source.gameId}>
                    <a
                      href={`/admin/tournaments/${data.edition.slug}/matches/${source.fixtureId}`}
                    >
                      {source.gameId}
                    </a>{" "}
                    · {tr("Revision {value0}", { value0: source.revision })}{" "}
                    <code>{source.fingerprint.slice(0, 12)}</code>
                  </li>
                ))}
              </ul>
            </details>
            <AwardTable
              {...report}
              candidates={report.candidates.map((c) => ({
                ...c,
                username: report.identities.find((p) => p.userId === c.userId)!
                  .username,
              }))}
            />
            <div className="actions">
              <button
                disabled={
                  busy ||
                  dirty ||
                  !!report.issues.length ||
                  release?.fingerprint === report.fingerprint
                }
                onClick={() => {
                  if (
                    window.confirm(
                      tr("Approve and publish this weekly award calculation?"),
                    )
                  )
                    void send({
                      action: "publish",
                      week: selected,
                      fingerprint: report.fingerprint,
                    });
                }}
              >
                {tr("Approve & publish")}
              </button>
              {release && (
                <button
                  className="secondary"
                  disabled={busy}
                  onClick={() => {
                    void send({
                      action: "unpublish",
                      week: selected,
                      releaseId: release.id,
                    });
                  }}
                >
                  {tr("Unpublish")}
                </button>
              )}
            </div>
          </>
        ) : (
          <p className="muted">
            {tr("Configure award weeks before reviewing results.")}
          </p>
        )}
      </section>
    </div>
  );
}
