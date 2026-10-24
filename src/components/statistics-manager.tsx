"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { useAppTranslations } from "@/i18n/shared";
import type { StatisticsWorkspace } from "@/lib/archive-statistics";
import { canExcludeStatisticsScore } from "@/lib/archive-statistics-model";
import { ConfirmMutation } from "./confirm-mutation";
type Review = StatisticsWorkspace["reviews"][number];
function SourceReview({
  review,
  pools,
  busy,
  save,
}: {
  review: Review;
  pools: StatisticsWorkspace["pools"];
  busy: boolean;
  save: (body: Record<string, unknown>) => Promise<void>;
}) {
  const tr = useAppTranslations();
  const [poolId, setPool] = useState(review.poolId);
  const [included, setIncluded] = useState(
    review.games.filter((g) => g.included).map((g) => g.game.id),
  );
  const [allowUnlistedMaps, setAllowUnlisted] = useState(
    review.allowUnlistedMaps,
  );
  const [excludedScores, setExcludedScores] = useState(review.excludedScores);
  const exclusionsChanged =
    JSON.stringify(excludedScores) !== JSON.stringify(review.excludedScores);
  const poolChanged =
    poolId !== review.poolId ||
    allowUnlistedMaps !== review.allowUnlistedMaps ||
    exclusionsChanged;
  return (
    <section className="statistics-review stack">
      <h3>MP {review.mpId}</h3>
      <a href={"https://osu.ppy.sh/community/matches/" + review.mpId}>
        {tr("Open MP history")}
      </a>
      {!review.complete && (
        <p className="notice">
          {tr("Complete, closed MP history is required.")}
        </p>
      )}
      {review.warnings.map((w) => (
        <p className="muted" key={w}>
          {tr(w)}
        </p>
      ))}
      <label className="field">
        <span>{tr("Recorded mappool")}</span>
        <select
          aria-label={tr("Recorded mappool")}
          value={poolId}
          disabled={busy}
          onChange={(e) => {
            setPool(e.target.value);
            setIncluded([]);
          }}
        >
          <option value="">
            {tr("MP beatmaps; historical mappool unavailable")}
          </option>
          {pools.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label className="checkbox-field">
        <input
          type="checkbox"
          checked={allowUnlistedMaps}
          disabled={busy}
          onChange={(e) => {
            setAllowUnlisted(e.target.checked);
            setIncluded([]);
          }}
        />
        {tr(
          "I reviewed the MP beatmaps because the historical mappool is incomplete.",
        )}
      </label>
      {poolChanged && (
        <p role="status">{tr("Save review settings before choosing games.")}</p>
      )}
      <p className="muted">
        {tr(
          "Select official scoring games only. Exclude warmups, aborted games and superseded replays.",
        )}
      </p>
      <p className="muted">
        {tr(
          "Exclude zero-score lobby records only after confirming that the user did not play. Keep genuine failed scores.",
        )}
      </p>
      <div className="actions">
        <button
          type="button"
          className="secondary"
          disabled={busy || poolChanged}
          onClick={() =>
            setIncluded(
              review.games
                .filter((g) => !g.issues.length)
                .map((g) => g.game.id),
            )
          }
        >
          {tr("Select eligible games")}
        </button>
        <button
          className="secondary"
          type="button"
          disabled={busy}
          onClick={() => setIncluded([])}
        >
          {tr("Clear selection")}
        </button>
      </div>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr("Review MP games")}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">{tr("Include")}</th>
              <th scope="col">{tr("Game")}</th>
              <th scope="col">{tr("Beatmap")}</th>
              <th scope="col">{tr("Score records")}</th>
            </tr>
          </thead>
          <tbody>
            {review.games.map(({ game, issues }) => (
              <tr key={game.id}>
                <td>
                  <input
                    type="checkbox"
                    aria-label={tr("Include game") + " " + game.id}
                    checked={included.includes(game.id)}
                    disabled={busy || poolChanged || issues.length > 0}
                    onChange={(e) =>
                      setIncluded(
                        e.target.checked
                          ? [...included, game.id]
                          : included.filter((id) => id !== game.id),
                      )
                    }
                  />
                </td>
                <td>
                  {game.id}
                  <br />
                  <small>{game.startTime}</small>
                </td>
                <td>
                  {game.beatmap?.artist} {game.beatmap?.title}
                  <br />
                  <a href={"https://osu.ppy.sh/beatmaps/" + game.beatmapId}>
                    #{game.beatmapId}
                  </a>
                  {issues.map((s) => (
                    <p className="muted" key={s}>
                      {tr(s)}
                    </p>
                  ))}
                </td>
                <td>
                  <details>
                    <summary>
                      {game.scores.length} · {tr("Players")}
                    </summary>
                    {game.scores.map((s, i) => (
                      <p className="statistics-game-score" key={i}>
                        <span>
                          {tr("osu! ID")} {s.osuId ?? "—"}
                        </span>
                        <span>{s.team ?? "—"}</span>
                        <span>{s.total?.toLocaleString() ?? "—"}</span>
                        <span>
                          {s.accuracy === null
                            ? "—"
                            : (s.accuracy * 100).toFixed(2) + "%"}
                        </span>
                        <span>{s.mods.join(" ") || "NM"}</span>
                        {canExcludeStatisticsScore(s) && (
                          <label className="checkbox-field">
                            <input
                              type="checkbox"
                              aria-label={
                                tr("Exclude score") +
                                " " +
                                game.id +
                                " · " +
                                s.osuId
                              }
                              checked={excludedScores.some(
                                (e) =>
                                  e.gameId === game.id && e.osuId === s.osuId,
                              )}
                              disabled={busy}
                              onChange={(e) => {
                                setExcludedScores(
                                  e.target.checked
                                    ? [
                                        ...excludedScores,
                                        { gameId: game.id, osuId: s.osuId! },
                                      ]
                                    : excludedScores.filter(
                                        (v) =>
                                          v.gameId !== game.id ||
                                          v.osuId !== s.osuId,
                                      ),
                                );
                                setIncluded([]);
                              }}
                            />
                            {tr("Exclude score")}
                          </label>
                        )}
                      </p>
                    ))}
                  </details>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          void save({
            action: "review",
            mpId: review.mpId,
            expectedVersion: review.version,
            poolId,
            included,
            allowUnlistedMaps,
            excludedScores,
          })
        }
      >
        {tr("Save statistics review")}
      </button>
    </section>
  );
}
export function StatisticsManager({
  initial,
}: {
  initial: StatisticsWorkspace;
}) {
  const tr = useAppTranslations();
  const [data, setData] = useState(initial),
    [fixtureId, setFixture] = useState("");
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [errors, setErrors] = useState<string[]>([]);
  const stop = useRef(false);
  const url = "/api/admin/tournaments/" + data.slug + "/statistics";
  async function load(id: string) {
    const response = await fetch(url + "?fixture=" + encodeURIComponent(id));
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    return result as StatisticsWorkspace;
  }
  async function post(body: Record<string, unknown>) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error);
    setData(result);
    return result as StatisticsWorkspace;
  }
  async function save(body: Record<string, unknown>) {
    setBusy(true);
    setErrors([]);
    setMessage("");
    try {
      await post(body);
      setMessage(tr("Statistics draft saved."));
    } catch (e) {
      setErrors([(e as Error).message]);
    } finally {
      setBusy(false);
    }
  }
  async function importSources(ids: number[]) {
    setBusy(true);
    setErrors([]);
    stop.current = false;
    let current = data;
    const failures: string[] = [];
    try {
      for (const [i, mpId] of ids.entries()) {
        if (stop.current) break;
        setMessage(
          tr("Importing MP") +
            " " +
            mpId +
            " · " +
            (i + 1) +
            " / " +
            ids.length,
        );
        try {
          current = await post({
            action: "import",
            mpId,
            expectedVersion:
              current.summaries.find((s) => s.mpId === mpId)?.version ?? 0,
          });
        } catch (e) {
          failures.push("MP " + mpId + ": " + tr((e as Error).message));
        }
      }
      setMessage(
        stop.current
          ? tr("Import stopped. Saved progress is retained.")
          : tr("Import complete. Review each match before publishing."),
      );
      if (fixtureId) await load(fixtureId);
    } catch {
      failures.push(tr("Connection interrupted. Reload before retrying."));
    } finally {
      setBusy(false);
      setErrors(failures);
    }
  }
  const fixture = data.fixtures.find((f) => f.id === fixtureId);
  const versions = Object.fromEntries(
    data.summaries
      .filter((s) => s.fixtureId === fixtureId)
      .map((s) => [String(s.mpId), s.version]),
  );
  const missing = data.fixtures
    .flatMap((f) => f.mpIds)
    .filter((id) => !data.summaries.some((s) => s.mpId === id && !s.stale));
  return (
    <div className="stack statistics-workspace">
      <p className="muted">
        {tr(
          "Import MP history into a private statistics draft, review scoring games, then approve and publish. Existing match results stay unchanged.",
        )}
      </p>
      <div className="actions">
        <Link href={"/tournaments/" + data.slug + "/statistics"}>
          {tr("Open public statistics")}
        </Link>
        <button
          type="button"
          disabled={busy || !missing.length}
          onClick={() => void importSources(missing)}
        >
          {tr("Import missing MP histories")} ({missing.length})
        </button>
        {busy && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              stop.current = true;
            }}
          >
            {tr("Stop after current MP")}
          </button>
        )}
      </div>
      <p role="status">{message}</p>
      {errors.length > 0 && (
        <ul role="alert" className="notice">
          {errors.map((e) => (
            <li key={e}>{tr(e)}</li>
          ))}
        </ul>
      )}
      <label className="field">
        <span>{tr("Match")}</span>
        <select
          aria-label={tr("Match")}
          value={fixtureId}
          disabled={busy}
          onChange={(e) => {
            const id = e.target.value;
            setFixture(id);
            setErrors([]);
            setBusy(true);
            void load(id)
              .catch((error) => setErrors([error.message]))
              .finally(() => setBusy(false));
          }}
        >
          <option value="">{tr("Select a match")}</option>
          {data.fixtures.map((f) => (
            <option key={f.id} value={f.id}>
              {f.stage} · {f.label} · {f.teams.join(" / ")} ·{" "}
              {f.score?.join(" : ")}
            </option>
          ))}
        </select>
      </label>
      <div
        className="table-scroll"
        tabIndex={0}
        role="region"
        aria-label={tr("MP import coverage")}
      >
        <table>
          <thead>
            <tr>
              <th scope="col">{tr("Round")}</th>
              <th scope="col">{tr("Match")}</th>
              <th scope="col">{tr("MP link")}</th>
              <th scope="col">{tr("Import status")}</th>
              <th scope="col">{tr("Publication")}</th>
              <th scope="col">{tr("Actions")}</th>
            </tr>
          </thead>
          <tbody>
            {data.fixtures.flatMap((f) =>
              f.mpIds.map((mpId) => {
                const s = data.summaries.find((s) => s.mpId === mpId);
                return (
                  <tr key={mpId}>
                    <td>{f.stage}</td>
                    <td>{f.label}</td>
                    <td>
                      <a href={"https://osu.ppy.sh/community/matches/" + mpId}>
                        {mpId}
                      </a>
                    </td>
                    <td>
                      {s
                        ? s.stale
                          ? tr("Archive changed")
                          : tr("Imported")
                        : tr("Not imported")}
                    </td>
                    <td>
                      {s?.publishedAt ? tr("Published") : tr("Unpublished")}
                      {s?.publishedAt && s.changes && (
                        <small>{tr("Unpublished changes")}</small>
                      )}
                    </td>
                    <td>
                      <button
                        className="secondary"
                        type="button"
                        disabled={busy}
                        onClick={() => void importSources([mpId])}
                      >
                        {s ? tr("Refresh MP") : tr("Import MP")}
                      </button>
                    </td>
                  </tr>
                );
              }),
            )}
          </tbody>
        </table>
      </div>
      {fixture && (
        <section className="stack">
          <h2>
            {fixture.label} · {fixture.teams.join(" / ")} ·{" "}
            {fixture.score?.join(" : ")}
          </h2>
          {data.reviews.map((review) => (
            <SourceReview
              key={review.mpId + ":" + review.version}
              review={review}
              pools={data.pools}
              busy={busy}
              save={save}
            />
          ))}
          {data.blockers.length > 0 && (
            <ul className="notice">
              {data.blockers.map((s) => (
                <li key={s}>{tr(s)}</li>
              ))}
            </ul>
          )}
          {data.canPublish && (
            <div className="actions">
              <ConfirmMutation
                label={tr("Approve & publish statistics")}
                title={tr("Approve & publish statistics")}
                description={tr(
                  "Publish the reviewed scoring games for this match. All recorded MP links must be imported and selected games must match the historical series score.",
                )}
                url={url}
                payload={{
                  action: "publish",
                  fixtureId,
                  expectedVersions: versions,
                  confirmed: true,
                }}
                disabled={busy || data.blockers.length > 0}
                onSuccess={() => {
                  void load(fixtureId);
                }}
              />
              <ConfirmMutation
                label={tr("Withdraw statistics")}
                title={tr("Withdraw statistics")}
                description={tr(
                  "Hide this match's published statistics. Its historical result remains visible.",
                )}
                url={url}
                payload={{
                  action: "withdraw",
                  fixtureId,
                  expectedVersions: versions,
                  confirmed: true,
                }}
                disabled={
                  busy ||
                  !data.summaries.some(
                    (s) => s.fixtureId === fixtureId && s.publishedAt,
                  )
                }
                onSuccess={() => {
                  void load(fixtureId);
                }}
              />
            </div>
          )}
        </section>
      )}
    </div>
  );
}
