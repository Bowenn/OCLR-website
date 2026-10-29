"use client";
import { refereeMessage } from "@/i18n/referee";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAppTranslations } from "@/i18n/shared";
import type { RefereeReconciliationWorkspace } from "@/lib/referee-reconciliation";

export function RefereeReconciliation({
  slug,
  fixtureId,
}: {
  slug: string;
  fixtureId: string;
}) {
  const tr = useAppTranslations();
  const [data, setData] = useState<RefereeReconciliationWorkspace | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<{
    body: Record<string, unknown>;
    attemptId: string;
  } | null>(null);
  const url = `/api/admin/tournaments/${slug}/matches/${fixtureId}/referee/reconciliation`;
  const load = useCallback(async () => {
    const response = await fetch(url, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }, [url]);
  useEffect(() => {
    let active = true;
    fetch(url, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error);
        if (active) setData(body);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [url]);
  async function save(attemptId: string) {
    if (!data || busy) return;
    const value = choices[attemptId] ?? "";
    let request = pending;
    if (!request) {
      const [importId, gameId] = value.split(":");
      const source = data.sources.find((s) => s.importId === importId);
      request = {
        attemptId,
        body: {
          requestKey: crypto.randomUUID(),
          expectedRevision: data.revision,
          expectedSessionRevision: data.sessionRevision,
          dependencyFingerprint: data.dependencyFingerprint,
          attemptId,
          importId: source?.importId ?? null,
          sourceFingerprint: source?.fingerprint ?? null,
          gameId: source ? Number(gameId) : null,
        },
      };
    }
    setPending(request);
    setBusy(true);
    setError("");
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request.body),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status < 500) setPending(null);
        throw new Error(body.error);
      }
      setPending(null);
      setData(body.workspace);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : tr("The request could not be completed."),
      );
    } finally {
      setBusy(false);
    }
  }
  const team = (id: string | null) =>
    data?.teams.find((t) => t.id === id)?.name ?? tr("Not available");
  const statuses = {
    unmatched: tr("Not linked to an MP game"),
    stale: tr("Record or source changed; confirm the link again"),
    missing: tr("Saved MP game is missing"),
    incomplete: tr("Incomplete game or referee record"),
    different_map: tr("Different beatmap"),
    different_result: tr("Result differs; review required"),
    matched: tr("Recorded result matches this MP game"),
  };
  return (
    <section
      className="panel form-stack"
      aria-labelledby="referee-reconciliation-heading"
    >
      <div className="section-heading">
        <div>
          <h2 id="referee-reconciliation-heading">
            {tr("Post-match reconciliation")}
          </h2>
          <p className="small muted">
            {tr(
              "Match each attempt to a saved MP game. Repeated plays need separate links. This does not submit or publish a result.",
            )}
          </p>
        </div>
      </div>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => {
            setError("");
            load().catch((e) => setError(e.message));
          }}
        >
          {tr("Refresh reconciliation")}
        </button>
        <Link
          className="button secondary"
          href={`/admin/tournaments/${slug}/matches/${fixtureId}`}
        >
          {tr("Open MP review")}
        </Link>
      </div>
      {error && (
        <p role="alert" className="notice">
          {refereeMessage(tr, error)}
        </p>
      )}
      {pending && !busy && (
        <div className="notice">
          <p>
            {tr(
              "The previous save has an unknown outcome. Retry the same request before changing this link.",
            )}
          </p>
          <button type="button" onClick={() => save(pending!.attemptId)}>
            {tr("Retry save")}
          </button>
        </div>
      )}
      {!data && !error && <p>{tr("Loading…")}</p>}
      {data && (
        <>
          <p>
            {tr("Referee provisional score")}:{" "}
            {data.teams
              .map((t) => `${t.name} ${data.ledgerScore[t.id] ?? 0}`)
              .join(" · ")}
          </p>
          {data.official ? (
            <p className="small muted">
              {tr("Saved result revision")}: {data.official.revision} ·{" "}
              {data.official.publishedRevision === data.official.revision
                ? tr("Published result")
                : tr("Not published")}
              {data.official.series &&
                ` · ${data.official.series.homeWins} – ${data.official.series.awayWins}`}
            </p>
          ) : (
            <p className="small muted">{tr("No result submitted")}</p>
          )}
          {!data.rows.length && (
            <p>
              {tr(
                "Record a Pick and its attempts before reconciling MP games.",
              )}
            </p>
          )}
          {data.rows.map((row) => (
            <article className="panel form-stack" key={row.attemptId}>
              <h3>
                {row.category} · {row.beatmapId} ·{" "}
                {tr("Attempt {value0}", { value0: row.attemptNumber })}
              </h3>
              <p className="small">
                {tr("Picked by")}: {team(row.pickTeamId)} ·{" "}
                {tr("Recorded winner")}: {team(row.winnerTeamId)}
              </p>
              <p role="status">{statuses[row.status]}</p>
              {row.link?.importId && (
                <p className="small muted">
                  {tr("Saved game link")}: {row.link.gameId} · {tr("MP winner")}
                  : {team(row.sourceWinnerTeamId)}
                </p>
              )}
              {data.canRecord && (
                <div className="form-stack">
                  <label className="field">
                    <span>{tr("Choose the exact saved MP game")}</span>
                    <select
                      disabled={busy || pending !== null}
                      value={choices[row.attemptId] ?? ""}
                      onChange={(e) =>
                        setChoices({
                          ...choices,
                          [row.attemptId]: e.target.value,
                        })
                      }
                    >
                      <option value="">{tr("No game link")}</option>
                      {data.sources
                        .filter((s) => s.current)
                        .flatMap((s) =>
                          s.games
                            .filter((g) => g.beatmapId === row.beatmapId)
                            .map((g) => (
                              <option
                                key={`${s.importId}:${g.id}`}
                                value={`${s.importId}:${g.id}`}
                              >
                                MP {s.matchId} · {tr("Game")} {g.id} ·{" "}
                                {team(g.winnerTeamId)}
                              </option>
                            )),
                        )}
                    </select>
                  </label>
                  <button
                    type="button"
                    className="secondary"
                    disabled={busy || pending !== null}
                    onClick={() => save(row.attemptId)}
                  >
                    {tr("Save game link")}
                  </button>
                </div>
              )}
            </article>
          ))}
          {data.history.length > 0 && (
            <details>
              <summary>{tr("Reconciliation history")}</summary>
              <ul>
                {data.history.map((entry) => (
                  <li key={entry.id}>
                    {tr("Saved result revision")}: {entry.revision} ·{" "}
                    {tr("Game")} {entry.gameId ?? "—"} ·{" "}
                    {tr("Referee record revision")}: {entry.sessionRevision}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}
    </section>
  );
}
