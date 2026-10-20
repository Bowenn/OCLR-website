"use client";
import Link from "next/link";
import { useState } from "react";
import type { MatchReview } from "@/lib/results";
import type { GameDecision } from "@/lib/match-model";
import { previewMatch } from "@/lib/match-scoring";
import { ConfirmMutation } from "./confirm-mutation";

function Operation({
  label,
  action,
  data,
  slug,
  extra = {},
  onError,
}: {
  label: string;
  action: string;
  data: MatchReview;
  slug: string;
  extra?: Record<string, unknown>;
  onError: (message: string) => void;
}) {
  const [requestKey, setKey] = useState(() => crypto.randomUUID());
  const [decisionNote, setDecisionNote] = useState("");
  const needsExplanation = action === "reject" || action === "void";
  return (
    <ConfirmMutation
      canConfirm={!needsExplanation || Boolean(decisionNote.trim())}
      label={label}
      title={label}
      description={`Fixture: ${data.context.fixture.label}. ${action === "publish" || action === "void" ? "This changes public results and dependent standings or bracket slots. Review every dependent fixture before confirming." : "This operation is recorded automatically with your osu! identity."}`}
      url={`/api/admin/tournaments/${slug}/matches/${data.context.fixture.id}/results`}
      payload={{
        action,
        requestKey,
        expectedVersion: data.context.result?.version ?? 0,
        expectedFixtureVersion: data.context.fixture.version,
        confirmed: true,
        ...(needsExplanation ? { decisionNote } : {}),
        ...extra,
      }}
      onSuccess={() => {
        setKey(crypto.randomUUID());
        onError("");
      }}
      onError={onError}
    >
      {needsExplanation && (
        <label className="field">
          <span>
            {action === "reject"
              ? "Proposal rejection explanation"
              : "Result withdrawal explanation"}
          </span>
          <textarea
            value={decisionNote}
            onChange={(e) => setDecisionNote(e.target.value)}
            maxLength={1000}
            required
          />
        </label>
      )}
    </ConfirmMutation>
  );
}
function SourceReview({
  data,
  slug,
  onError,
}: {
  data: MatchReview;
  slug: string;
  onError: (message: string) => void;
}) {
  const source = data.source!;
  const [decisions, setDecisions] = useState<Record<number, GameDecision>>({});
  const [rulesConfirmed, setRules] = useState(false);
  const [sourceConfirmed, setSource] = useState(false);
  const [publicNote, setNote] = useState("");
  const list = Object.values(decisions);
  const preview = previewMatch(source, data.context, list);
  const teamName = (id: string | null) =>
    data.context.teams.find((t) => t.id === id)?.name ?? "Unresolved";
  function update(id: number, value: Partial<GameDecision>) {
    setDecisions((old) => ({
      ...old,
      [id]: {
        ...(old[id] ?? {
          gameId: id,
          included: false,
          reason: "",
          complianceConfirmed: false,
          substitutions: [],
        }),
        ...value,
      },
    }));
  }
  return (
    <section className="section-space stack" aria-labelledby="games-heading">
      <div>
        <p className="eyebrow">REFEREE REVIEW</p>
        <h2 id="games-heading">Review every game</h2>
        <p className="muted">
          Include valid games and explicitly exclude warmups, rematches or
          invalid games with a reason. Raw provider scores cannot be edited
          here.
        </p>
      </div>
      {source.warnings.map((warning, i) => (
        <p className="notice" key={i}>
          {warning}
        </p>
      ))}
      {data.diff && (
        <div className="notice">
          <strong>Upstream changes require review</strong>
          <p>
            Added games: {data.diff.added.join(", ") || "None"}. Removed games:{" "}
            {data.diff.removed.join(", ") || "None"}. Changed games:{" "}
            {data.diff.changed.join(", ") || "None"}.
          </p>
        </div>
      )}
      {preview.games.map((g, i) => {
        const decision = decisions[g.game.id];
        const unknown = g.players.filter(
          (p) =>
            p.osuId &&
            !data.context.teams.some((t) =>
              t.members.some((m) => m.osuId === p.osuId),
            ),
        );
        return (
          <details className="panel" key={g.game.id} open={undefined}>
            <summary>
              <strong>
                Game {i + 1} ·{" "}
                {g.game.beatmap?.title ??
                  (g.game.beatmapId
                    ? `Beatmap ${g.game.beatmapId}`
                    : "Unavailable beatmap")}
              </strong>{" "}
              ·{" "}
              {decision
                ? decision.included
                  ? "Included"
                  : "Excluded"
                : "Unreviewed"}
            </summary>
            <div className="form-stack">
              <p className="muted">
                Game ID {g.game.id} · {g.game.teamType ?? "Unknown team mode"} ·{" "}
                {g.game.scoringType ?? "Unknown scoring"} ·{" "}
                {g.game.mods.join(", ") || "NM"}
              </p>
              {g.game.beatmapId && (
                <a
                  className="text-link"
                  href={`https://osu.ppy.sh/beatmaps/${g.game.beatmapId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Open beatmap ↗
                </a>
              )}
              <div
                className="table-scroll"
                role="region"
                tabIndex={0}
                aria-label={`Recorded game ${i + 1} scores; scroll horizontally`}
              >
                <table>
                  <caption>Recorded player scores for game {i + 1}</caption>
                  <thead>
                    <tr>
                      <th>osu! player</th>
                      <th>Team evidence</th>
                      <th>Score</th>
                      <th>Lobby side</th>
                      <th>Passed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.players.map((p, n) => (
                      <tr key={`${p.osuId}-${n}`}>
                        <td>
                          {data.context.teams
                            .flatMap((t) => t.members)
                            .find((m) => m.osuId === p.osuId)?.username ??
                            `osu! ID ${p.osuId ?? "unavailable"}`}
                        </td>
                        <td>
                          {p.teamId
                            ? `${teamName(p.teamId)} (${p.evidence})`
                            : "Unresolved"}
                        </td>
                        <td>{p.total?.toLocaleString() ?? "Unavailable"}</td>
                        <td>{p.team ?? "Unknown"}</td>
                        <td>
                          {p.passed === null
                            ? "Unknown"
                            : p.passed
                              ? "Yes"
                              : "No"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <label className="field">
                <span>Game {i + 1} decision</span>
                <select
                  value={decision ? String(decision.included) : ""}
                  onChange={(e) => {
                    if (!e.target.value) {
                      setDecisions((old) => {
                        const next = { ...old };
                        delete next[g.game.id];
                        return next;
                      });
                    } else
                      update(g.game.id, {
                        included: e.target.value === "true",
                      });
                  }}
                >
                  <option value="">Choose after reviewing</option>
                  <option value="true">Include in result</option>
                  <option value="false">Exclude from result</option>
                </select>
              </label>
              {decision && (!decision.included || g.warnings.length > 0) && (
                <label className="field">
                  <span>
                    Game {i + 1}{" "}
                    {decision.included
                      ? "scoring decision explanation"
                      : "exclusion explanation"}
                  </span>
                  <textarea
                    maxLength={1000}
                    value={decision?.reason ?? ""}
                    onChange={(e) =>
                      update(g.game.id, { reason: e.target.value })
                    }
                  />
                </label>
              )}
              <label className="check-label">
                <input
                  type="checkbox"
                  checked={decision?.complianceConfirmed ?? false}
                  onChange={(e) =>
                    update(g.game.id, { complianceConfirmed: e.target.checked })
                  }
                />
                Game {i + 1}: I verified mods and the approved tournament rules
              </label>
              {unknown.map((p) => {
                const existing = decision?.substitutions.find(
                  (s) => s.osuId === p.osuId,
                );
                const replace = (teamId: string, reason: string) =>
                  update(g.game.id, {
                    substitutions: [
                      ...(decision?.substitutions.filter(
                        (s) => s.osuId !== p.osuId,
                      ) ?? []),
                      ...(teamId ? [{ osuId: p.osuId!, teamId, reason }] : []),
                    ],
                  });
                return (
                  <fieldset key={p.osuId}>
                    <legend>
                      Non-roster player {p.osuId}: substitution evidence
                    </legend>
                    <p className="muted">
                      Requires a configured substitution policy. This does not
                      change the official roster.
                    </p>
                    <label className="field">
                      <span>Confirmed team for osu! ID {p.osuId}</span>
                      <select
                        value={existing?.teamId ?? ""}
                        onChange={(e) =>
                          replace(e.target.value, existing?.reason ?? "")
                        }
                      >
                        <option value="">Unresolved</option>
                        {data.context.teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Substitution reason for osu! ID {p.osuId}</span>
                      <input
                        value={existing?.reason ?? ""}
                        maxLength={500}
                        onChange={(e) =>
                          replace(existing?.teamId ?? "", e.target.value)
                        }
                      />
                    </label>
                  </fieldset>
                );
              })}
              {g.problems.map((p, n) => (
                <p className="notice error-text" key={n}>
                  {p}
                </p>
              ))}
              {g.warnings.map((p, n) => (
                <p className="notice" key={n}>
                  {p}
                </p>
              ))}
              <p>
                Calculated team score: {g.homeScore ?? "—"} :{" "}
                {g.awayScore ?? "—"}.{" "}
                {g.tied
                  ? "Tied game"
                  : g.winnerTeamId
                    ? `Winner: ${teamName(g.winnerTeamId)}`
                    : "No verified winner"}
                .
              </p>
            </div>
          </details>
        );
      })}
      <article className="panel stack">
        <h3>New review preview</h3>
        <p className="score">
          {preview.series.homeWins} : {preview.series.awayWins}
        </p>
        <p>
          {preview.series.complete
            ? preview.series.draw
              ? "Configured draw"
              : `Proposed winner: ${teamName(preview.series.winnerTeamId)}`
            : "Series not resolved"}{" "}
          · {preview.series.includedGames} included games
        </p>
        {preview.blockers.map((b, i) => (
          <p className="notice" key={i}>
            {b}
          </p>
        ))}
        <label className="field">
          <span>Public result note (optional, visible after publication)</span>
          <textarea
            maxLength={1000}
            value={publicNote}
            onChange={(e) => setNote(e.target.value)}
          />
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={rulesConfirmed}
            onChange={(e) => setRules(e.target.checked)}
          />
          I verified the configured scoring rules against the approved OCLR
          rules
        </label>
        <label className="check-label">
          <input
            type="checkbox"
            checked={sourceConfirmed}
            onChange={(e) => setSource(e.target.checked)}
          />
          I reviewed the current source snapshot and all reported changes
        </label>
        {preview.canSubmit && rulesConfirmed && sourceConfirmed ? (
          <Operation
            label="Submit proposed result"
            action="submit"
            data={data}
            slug={slug}
            extra={{
              importId: data.importId,
              decisions: list,
              rulesConfirmed: true,
              sourceChangesConfirmed: true,
              publicNote,
            }}
            onError={onError}
          />
        ) : (
          <p className="muted">
            Complete every game decision, resolve blockers and confirm the
            review to submit.
          </p>
        )}
      </article>
    </section>
  );
}
export function MatchReviewPanel({
  data,
  slug,
}: {
  data: MatchReview;
  slug: string;
}) {
  const [match, setMatch] = useState("");

  const [requestKey, setKey] = useState(() => crypto.randomUUID());
  const [notice, setNotice] = useState("");
  const [progression, setProgression] = useState(false);
  const { context } = data;
  const state = context.result;
  const base = `/api/admin/tournaments/${slug}/matches/${context.fixture.id}`;
  return (
    <div className="stack">
      {notice && (
        <p className="notice error-text" role="alert">
          {notice}
        </p>
      )}
      <section className="panel form-stack">
        <h2>Import official multiplayer data</h2>
        <p className="muted">
          Only osu! match IDs or canonical osu! match URLs are accepted. Imports
          are private snapshots; they never publish scores automatically.
        </p>
        <label className="field">
          <span>osu! MP link or match ID</span>
          <input
            type="text"
            inputMode="url"
            maxLength={250}
            value={match}
            onChange={(e) => setMatch(e.target.value)}
            placeholder="https://osu.ppy.sh/community/matches/…"
          />
        </label>
        <ConfirmMutation
          requireConfirmation={false}
          label="Retrieve match data"
          title="Import an official osu! match snapshot"
          description="The provider snapshot will be stored for staff review. Any existing published result stays unchanged."
          url={`${base}/imports`}
          payload={{
            requestKey,
            expectedVersion: state?.version ?? 0,
            expectedFixtureVersion: context.fixture.version,
            match,
            confirmed: true,
          }}
          onSuccess={() => {
            setKey(crypto.randomUUID());
            setNotice("");
          }}
          onError={setNotice}
        />
        <p className="muted">
          Report version {state?.version ?? 0} · {state?.state ?? "No report"} ·
          Fixture version {context.fixture.version}
        </p>
        {data.sourceError && <p className="notice">{data.sourceError}</p>}
        {data.source && (
          <div>
            <a
              className="text-link"
              href={`https://osu.ppy.sh/community/matches/${data.source.match.id}`}
              target="_blank"
              rel="noreferrer"
            >
              MP #{data.source.match.id} ↗
            </a>
            <p>{data.source.match.title}</p>
            <p className="muted">
              Lobby titles do not establish official team identity. Retrieved{" "}
              {new Date(data.source.fetchedAt).toISOString()} ·{" "}
              {data.source.complete
                ? "Completed source history"
                : "Incomplete / ongoing source"}
            </p>
            <details>
              <summary>Source provenance</summary>
              <p className="break-anywhere">
                Fingerprint: {data.source.fingerprint}
              </p>
              <p>
                {data.source.pages} API pages · {data.source.events.length}{" "}
                normalized events
              </p>
            </details>
          </div>
        )}
      </section>
      <section className="panel stack">
        <h2>Official teams and scoring rules</h2>
        {context.teams.map((t) => (
          <div key={t.id}>
            <h3>{t.name}</h3>
            <p>
              {t.members.map((m) => `${m.username} (${m.osuId})`).join(" · ") ||
                "No published roster"}
            </p>
          </div>
        ))}
        <details>
          <summary>Configured round scoring rules</summary>
          {context.round.scoringRules ? (
            <pre className="rules-json">
              {JSON.stringify(context.round.scoringRules, null, 2)}
            </pre>
          ) : (
            <p className="notice">
              Awaiting approved scoring configuration. No winner will be
              assumed.
            </p>
          )}
        </details>
      </section>
      {data.source && (
        <SourceReview
          key={`${data.importId}-${context.fixture.version}-${context.round.version}-${context.pool?.version ?? 0}`}
          data={data}
          slug={slug}

          onError={setNotice}
        />
      )}
      <section className="panel stack">
        <h2>Approval and publication</h2>
        <p>
          Current revision: {data.current?.revision ?? "None"} · Published
          revision: {data.published?.revision ?? "None"}
        </p>
        {data.current?.proposal && (
          <p>
            Current proposal: {data.current.proposal.series.homeWins} :{" "}
            {data.current.proposal.series.awayWins} ·{" "}
            {data.current.approvedAt ? "Approved" : "Awaiting approval"}
          </p>
        )}
        {data.published?.proposal && (
          <p>
            Published score: {data.published.proposal.series.homeWins} :{" "}
            {data.published.proposal.series.awayWins}. It remains visible while
            a correction is under review.
          </p>
        )}
        {context.canApprove ? (
          <>
            {data.dependents.length > 0 && (
              <div>
                <h3>Dependent fixtures requiring review after a correction</h3>
                <ul>
                  {data.dependents.map((f) => (
                    <li key={f.id}>
                      <Link
                        className="text-link"
                        href={`/admin/tournaments/${slug}/matches/${f.id}`}
                      >
                        {f.label}
                      </Link>{" "}
                      · {f.published ? "Published fixture" : "Private fixture"}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <label className="check-label">
              <input
                type="checkbox"
                checked={progression}
                onChange={(e) => setProgression(e.target.checked)}
              />
              I reviewed the effect on dependent fixtures and public standings
              or brackets
            </label>
            <div className="actions">
              {state?.state === "submitted" && (
                <>
                  <Operation
                    label="Approve proposed result"
                    action="approve"
                    data={data}
                    slug={slug}
                    extra={{ revision: state.currentRevision }}
                    onError={setNotice}
                  />
                  <Operation
                    label="Reject proposed result"
                    action="reject"
                    data={data}
                    slug={slug}
                    extra={{ revision: state.currentRevision }}
                    onError={setNotice}
                  />
                </>
              )}
              {state?.state === "approved" &&
                progression &&
                state.currentRevision !== state.publishedRevision && (
                  <Operation
                    label="Publish approved result"
                    action="publish"
                    data={data}
                    slug={slug}
                    extra={{
                      revision: state.currentRevision,
                      progressionAcknowledged: true,
                    }}
                    onError={setNotice}
                  />
                )}
              {state?.publishedRevision && (
                <Operation
                  label="Unpublish result"
                  action="unpublish"
                  data={data}
                  slug={slug}

                  onError={setNotice}
                />
              )}
              {state && state.currentRevision > 0 && progression && (
                <Operation
                  label="Withdraw official result"
                  action="void"
                  data={data}
                  slug={slug}
                  extra={{ progressionAcknowledged: true }}
                  onError={setNotice}
                />
              )}
            </div>
            <p className="muted">
              Withdrawing retains the audit trail and source history. It does
              not award a forfeit or change team rosters. Publish the fixture
              before publishing its result.
            </p>
          </>
        ) : (
          <p className="notice">
            An Admin must approve and publish submitted results.
          </p>
        )}
      </section>
      <section className="section-space">
        <h2>Review history</h2>
        <div className="stack">
          {data.revisions.map((r) => (
            <details className="panel" key={r.revision}>
              <summary>
                Revision {r.revision} · osu! ID {r.createdBy} ·{" "}
                {r.approvedAt ? "Approved" : "Unapproved"}
              </summary>
              {r.reason && <p>{r.reason}</p>}
              <p>{new Date(r.createdAt).toISOString()}</p>
              {r.proposal && (
                <p>
                  Score {r.proposal.series.homeWins} :{" "}
                  {r.proposal.series.awayWins} · Rules{" "}
                  {r.proposal.rulesSnapshot.version}
                </p>
              )}
              {r.approvedBy && <p>Approved by osu! ID {r.approvedBy}</p>}
            </details>
          ))}
          {!data.revisions.length && (
            <p className="muted">No result revisions submitted.</p>
          )}
        </div>
      </section>
      <details className="panel">
        <summary>Internal audit trail</summary>
        <ul>
          {context.events.map((e) => (
            <li key={e.id}>
              {e.action} · osu! ID {e.actorId} ·{" "}
              {new Date(e.createdAt).toISOString()}
              {e.reason && <p>{e.reason}</p>}
              <details>
                <summary>Recorded changes</summary>
                <pre className="audit-json">
                  {JSON.stringify(e.detail, null, 2)}
                </pre>
              </details>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
