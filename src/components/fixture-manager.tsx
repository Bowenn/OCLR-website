"use client";
import Link from "next/link";
import { useState } from "react";
import type { FixtureWorkspace } from "@/lib/fixtures";
import { ConfirmMutation } from "./confirm-mutation";
type Fixture = FixtureWorkspace["fixtures"][number];
type Round = FixtureWorkspace["rounds"][number];
function FixtureForm({
  slug,
  data,
  fixture,
}: {
  slug: string;
  data: FixtureWorkspace;
  fixture?: Fixture;
}) {
  const [label, setLabel] = useState(fixture?.label ?? "");
  const [roundId, setRound] = useState(
    fixture?.roundId ?? data.rounds[0]?.round.id ?? "",
  );
  const [homeTeamId, setHome] = useState(fixture?.homeTeamId ?? "");
  const [awayTeamId, setAway] = useState(fixture?.awayTeamId ?? "");
  const [mappoolId, setPool] = useState(fixture?.mappoolId ?? "");
  const [position, setPosition] = useState(String(fixture?.position ?? 1));
  const [time, setTime] = useState(
    fixture?.scheduledAt?.toISOString().slice(0, 19) ?? "",
  );
  const [timeZone, setZone] = useState(fixture?.timeZone ?? data.timeZone);
  const [status, setStatus] = useState(fixture?.status ?? "scheduled");
  const [referees, setReferees] = useState(
    fixture?.refereeIds.join(", ") ?? "",
  );
  const [homeSourceId, setHomeSource] = useState(fixture?.homeSourceId ?? "");
  const [homeSourceOutcome, setHomeOutcome] = useState(
    fixture?.homeSourceOutcome ?? "winner",
  );
  const [awaySourceId, setAwaySource] = useState(fixture?.awaySourceId ?? "");
  const [awaySourceOutcome, setAwayOutcome] = useState(
    fixture?.awaySourceOutcome ?? "winner",
  );
  const round = data.rounds.find((r) => r.round.id === roundId);
  const payload = {
    label,
    roundId,
    homeTeamId,
    awayTeamId,
    mappoolId: mappoolId || null,
    position: Number(position),
    scheduledAt: time ? `${time}${time.length === 16 ? ":00" : ""}Z` : null,
    timeZone,
    status,
    refereeIds: referees.trim()
      ? referees.split(",").map((v) => Number(v.trim()))
      : [],
    homeSourceId: homeSourceId || null,
    homeSourceOutcome: homeSourceId ? homeSourceOutcome : null,
    awaySourceId: awaySourceId || null,
    awaySourceOutcome: awaySourceId ? awaySourceOutcome : null,
    action: fixture ? "edit" : "create",
    ...(fixture
      ? { fixtureId: fixture.id, expectedVersion: fixture.version }
      : {}),
    confirmed: true,
  };
  const teamOptions = data.teams.map((t) => (
    <option value={t.id} key={t.id}>
      {t.name}
    </option>
  ));
  function sourceSelect(side: "home" | "away") {
    const id = side === "home" ? homeSourceId : awaySourceId;
    const setId = side === "home" ? setHomeSource : setAwaySource;
    const outcome = side === "home" ? homeSourceOutcome : awaySourceOutcome;
    const setOutcome = side === "home" ? setHomeOutcome : setAwayOutcome;
    return (
      <div className="form-stack">
        <label className="field">
          <span>{side === "home" ? "Home" : "Away"} bracket source</span>
          <select value={id} onChange={(e) => setId(e.target.value)}>
            <option value="">Direct team slot — no progression link</option>
            {data.fixtures
              .filter(
                (f) =>
                  f.id !== fixture?.id &&
                  data.rounds.find((r) => r.round.id === f.roundId)?.stage ===
                    "knockout",
              )
              .map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
          </select>
        </label>
        {id && (
          <label className="field">
            <span>{side === "home" ? "Home" : "Away"} source outcome</span>
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value as "winner" | "loser")}
            >
              <option value="winner">Winner</option>
              <option value="loser">Loser</option>
            </select>
          </label>
        )}
      </div>
    );
  }
  return (
    <div className="form-stack">
      <p className="muted">
        Both teams must have finalized, published rosters. Leave the match time
        empty when it is unconfirmed.
      </p>
      <label className="field">
        <span>Fixture label</span>
        <input
          value={label}
          maxLength={100}
          onChange={(e) => setLabel(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Competition round</span>
        <select
          value={roundId}
          onChange={(e) => {
            setRound(e.target.value);
            setPool("");
          }}
        >
          {!data.rounds.length && (
            <option value="">No rounds configured</option>
          )}
          {data.stages
            .filter((s) => s.kind === "group")
            .map((s) => (
              <StageGroups
                key={`${s.id}-${s.version}`}
                stage={s}
                slug={slug}
                data={data}
              />
            ))}
          {data.rounds.map((r) => (
            <option key={r.round.id} value={r.round.id}>
              {r.stage === "group" ? "Group" : "Knockout"} / {r.round.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Home team</span>
        <select value={homeTeamId} onChange={(e) => setHome(e.target.value)}>
          <option value="">Choose an official team</option>
          {teamOptions}
        </select>
      </label>
      <label className="field">
        <span>Away team</span>
        <select value={awayTeamId} onChange={(e) => setAway(e.target.value)}>
          <option value="">Choose an official team</option>
          {teamOptions}
        </select>
      </label>
      <label className="field">
        <span>Fixture order within round</span>
        <input
          type="number"
          min={1}
          max={999}
          value={position}
          onChange={(e) => setPosition(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Associated mappool</span>
        <select value={mappoolId} onChange={(e) => setPool(e.target.value)}>
          <option value="">No pool associated</option>
          {data.pools
            .filter((p) => p.roundId === roundId)
            .map((p) => (
              <option value={p.id} key={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
      <label className="field">
        <span>Scheduled date and time (UTC; optional)</span>
        <input
          type="datetime-local"
          step={1}
          value={time}
          onChange={(e) => setTime(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Display time zone (IANA)</span>
        <input
          value={timeZone}
          maxLength={80}
          onChange={(e) => setZone(e.target.value)}
        />
      </label>
      <label className="field">
        <span>Fixture status</span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as Fixture["status"])}
        >
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In progress</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </label>
      <label className="field">
        <span>Assigned referee osu! IDs (comma-separated)</span>
        <input
          value={referees}
          maxLength={1000}
          onChange={(e) => setReferees(e.target.value)}
        />
      </label>
      {round?.stage === "knockout" && (
        <details>
          <summary>Explicit bracket progression</summary>
          <p className="muted">
            Optional winner/loser links describe only approved progression. Both
            official teams must still be confirmed for this fixture; no forfeits
            or advancement are inferred.
          </p>
          {sourceSelect("home")}
          {sourceSelect("away")}
        </details>
      )}
      <ConfirmMutation
        requireConfirmation={false}
        label={fixture ? "Save fixture amendment" : "Create fixture"}
        title={fixture ? "Amend fixture?" : "Create fixture?"}
        description={`${fixture ? "Amend" : "Create"} ${label || "the fixture"}. Times are entered in UTC and displayed in ${timeZone || "the configured zone"}. Referee assignments and all changes are audited.`}
        url={`/api/admin/tournaments/${slug}/matches`}
        payload={payload}
      />
    </div>
  );
}
function RoundRules({ slug, entry }: { slug: string; entry: Round }) {
  const { round, stage } = entry;
  const rules = round.scoringRules;
  const standings = round.standingsRules;
  const [teamType, setTeamType] = useState(rules?.teamType ?? "");
  const [drawPoints, setDrawPoints] = useState(
    String(standings?.drawPoints ?? ""),
  );
  const [failure, setFailure] = useState(rules?.failedScorePolicy ?? "");
  const [mapTies, setMapTies] = useState(rules?.tiedMapPolicy ?? "");
  const [shortHanded, setShortHanded] = useState(
    rules ? String(rules.allowShortHanded ?? "") : "",
  );
  const [enabled, setEnabled] = useState(Boolean(rules));
  const [version, setVersion] = useState(rules?.version ?? "");
  const [mode, setMode] = useState<string>(rules?.mode ?? "");
  const [scoreType, setScoreType] = useState<string>(rules?.scoringType ?? "");
  const [aggregation, setAggregation] = useState<string>(
    rules?.aggregation ?? "",
  );
  const [players, setPlayers] = useState(String(rules?.playersPerTeam ?? ""));
  const [series, setSeries] = useState<string>(rules?.series.type ?? "");
  const [maps, setMaps] = useState(
    String(
      rules?.series.type === "first_to"
        ? rules.series.wins
        : (rules?.series.count ?? ""),
    ),
  );
  const [draws, setDraws] = useState(
    rules?.series.type === "fixed_maps" ? String(rules.series.allowDraw) : "",
  );
  const [subs, setSubs] = useState(
    rules ? String(rules.allowSubstitutions) : "",
  );
  const [ranked, setRanked] = useState(Boolean(standings));
  const [standingsVersion, setStandingsVersion] = useState(
    standings?.version ?? "",
  );
  const [winPoints, setWinPoints] = useState(
    String(standings?.winPoints ?? ""),
  );
  const [lossPoints, setLossPoints] = useState(
    String(standings?.lossPoints ?? ""),
  );
  const [tiebreakers, setTiebreakers] = useState(
    standings?.tiebreakers.join(", ") ?? "",
  );
  return (
    <div className="form-stack">
      <p className="notice small">
        Only save organizer-approved rules. Unconfigured scoring cannot produce
        an official result; unconfigured standings cannot produce a ranking.
      </p>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        <span>Configure approved scoring rules</span>
      </label>
      {enabled && (
        <>
          <label className="field">
            <span>Approved scoring rules version</span>
            <input
              value={version}
              maxLength={80}
              onChange={(e) => setVersion(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Game mode</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="">Unconfirmed</option>
              {["osu", "taiko", "fruits", "mania"].map((m) => (
                <option value={m} key={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <p className="small muted">
            Automatic scoring supports configured roster aggregation with Score
            or Score v2. Other provider modes require review and cannot silently
            produce winners.
          </p>
          <label className="field">
            <span>Multiplayer team mode</span>
            <select
              value={teamType}
              onChange={(e) => setTeamType(e.target.value)}
            >
              <option value="">Unconfirmed</option>
              <option value="team-vs">Team vs</option>
              <option value="head-to-head">
                Head-to-head with explicit roster aggregation
              </option>
            </select>
          </label>
          <label className="field">
            <span>Scoring type</span>
            <select
              value={scoreType}
              onChange={(e) => setScoreType(e.target.value as typeof scoreType)}
            >
              <option value="">Unconfirmed</option>
              <option value="score">Score</option>
              <option value="scorev2">Score v2</option>
            </select>
          </label>
          <label className="field">
            <span>Team score aggregation</span>
            <select
              value={aggregation}
              onChange={(e) =>
                setAggregation(e.target.value as typeof aggregation)
              }
            >
              <option value="">Unconfirmed</option>
              <option value="sum">Sum</option>
              <option value="average">Average</option>
            </select>
          </label>
          <label className="field">
            <span>Players per team per game</span>
            <input
              type="number"
              min={1}
              max={16}
              value={players}
              onChange={(e) => setPlayers(e.target.value)}
            />
          </label>
          <label className="field">
            <span>Series format</span>
            <select
              value={series}
              onChange={(e) => setSeries(e.target.value as typeof series)}
            >
              <option value="">Unconfirmed</option>
              <option value="first_to">
                First to a configured number of map wins
              </option>
              <option value="fixed_maps">Fixed number of maps</option>
            </select>
          </label>
          <label className="field">
            <span>
              {series === "first_to" ? "Map wins required" : "Maps to play"}
            </span>
            <input
              type="number"
              min={1}
              max={99}
              value={maps}
              onChange={(e) => setMaps(e.target.value)}
            />
          </label>
          {series === "fixed_maps" && (
            <label className="field">
              <span>Tied series policy</span>
              <select value={draws} onChange={(e) => setDraws(e.target.value)}>
                <option value="">Unconfirmed</option>
                <option value="true">Draw permitted</option>
                <option value="false">Draw not permitted</option>
              </select>
            </label>
          )}
          <label className="field">
            <span>Failed player scores</span>
            <select
              value={failure}
              onChange={(e) => setFailure(e.target.value)}
            >
              <option value="">Unconfirmed</option>
              <option value="include">Count the recorded score</option>
              <option value="zero">Count failed scores as zero</option>
            </select>
          </label>
          <label className="field">
            <span>Tied map policy</span>
            <select
              value={mapTies}
              onChange={(e) => setMapTies(e.target.value)}
            >
              <option value="">Unconfirmed</option>
              <option value="require_replay">
                Require replay; exclude the tied original
              </option>
              <option value="count_as_draw">
                Count as a drawn map, without a map win
              </option>
            </select>
          </label>
          <label className="field">
            <span>Understrength teams</span>
            <select
              value={shortHanded}
              onChange={(e) => setShortHanded(e.target.value)}
            >
              <option value="">Unconfirmed</option>
              <option value="false">Require the configured player count</option>
              <option value="true">
                Allow fewer players with explicit review
              </option>
            </select>
          </label>
          <label className="field">
            <span>Substitution policy</span>
            <select value={subs} onChange={(e) => setSubs(e.target.value)}>
              <option value="">Unconfirmed</option>
              <option value="true">
                Allow explicitly reviewed substitutions
              </option>
              <option value="false">No substitutions</option>
            </select>
          </label>
        </>
      )}
      {stage === "group" && (
        <>
          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={ranked}
              onChange={(e) => setRanked(e.target.checked)}
            />
            <span>Configure approved group ranking rules</span>
          </label>
          {ranked && (
            <>
              <label className="field">
                <span>Approved standings rules version</span>
                <input
                  value={standingsVersion}
                  onChange={(e) => setStandingsVersion(e.target.value)}
                  maxLength={80}
                />
              </label>
              <label className="field">
                <span>Points for a win</span>
                <input
                  type="number"
                  value={winPoints}
                  onChange={(e) => setWinPoints(e.target.value)}
                  min={-100}
                  max={100}
                />
              </label>
              <label className="field">
                <span>Points for a loss</span>
                <input
                  type="number"
                  value={lossPoints}
                  onChange={(e) => setLossPoints(e.target.value)}
                  min={-100}
                  max={100}
                />
              </label>
              <label className="field">
                <span>Points for a draw (leave blank if unconfirmed)</span>
                <input
                  type="number"
                  min={-100}
                  max={100}
                  value={drawPoints}
                  onChange={(e) => setDrawPoints(e.target.value)}
                />
              </label>
              <label className="field">
                <span>Ranking criteria, in order</span>
                <input
                  value={tiebreakers}
                  onChange={(e) => setTiebreakers(e.target.value)}
                  maxLength={100}
                  placeholder="Approved criteria only"
                />
              </label>
              <p className="small muted">
                Supported explicit criteria: points, wins, map_difference,
                maps_won. Separate by commas. Unresolved ties remain tied.
              </p>
            </>
          )}
        </>
      )}
      <ConfirmMutation
        label="Save approved round rules"
        title="Confirm competition rules?"
        description={`Save the explicitly configured rules for ${round.name}. This does not publish any imported score.`}
        url={`/api/admin/tournaments/${slug}/matches`}
        payload={{
          action: "round_rules",
          roundId: round.id,
          expectedVersion: round.version,
          scoringRules: enabled
            ? {
                version,
                mode,
                teamType,
                scoringType: scoreType,
                aggregation,
                playersPerTeam: Number(players),
                series: !series
                  ? null
                  : series === "first_to"
                    ? { type: "first_to", wins: Number(maps) }
                    : {
                        type: "fixed_maps",
                        count: Number(maps),
                        allowDraw: draws === "" ? null : draws === "true",
                      },
                allowSubstitutions: subs === "" ? null : subs === "true",
                allowShortHanded:
                  shortHanded === "" ? null : shortHanded === "true",
                failedScorePolicy: failure,
                tiedMapPolicy: mapTies,
              }
            : null,
          standingsRules:
            stage === "group" && ranked
              ? {
                  version: standingsVersion,
                  winPoints: winPoints.trim() ? Number(winPoints) : null,
                  lossPoints: lossPoints.trim() ? Number(lossPoints) : null,
                  drawPoints: drawPoints.trim() ? Number(drawPoints) : null,
                  tiebreakers: tiebreakers.split(",").map((v) => v.trim()),
                }
              : null,
          confirmed: true,
        }}
      />
    </div>
  );
}
function StageGroups({
  slug,
  data,
  stage,
}: {
  slug: string;
  data: FixtureWorkspace;
  stage: FixtureWorkspace["stages"][number];
}) {
  const [groups, setGroups] = useState(stage.groupConfiguration?.groups ?? []);
  const [version, setVersion] = useState(
    stage.groupConfiguration?.version ?? "",
  );
  const [published, setPublished] = useState(Boolean(stage.groupsPublishedAt));
  return (
    <details className="form-stack">
      <summary>Approved Group Stage assignments</summary>
      <p className="muted">
        Configure the actual groups and team membership. Unpublished assignments
        never appear in standings. Each team may belong to one group in this
        stage.
      </p>
      <label className="field">
        <span>Approved group configuration version</span>
        <input
          value={version}
          maxLength={80}
          onChange={(e) => setVersion(e.target.value)}
        />
      </label>
      {groups.map((group, index) => (
        <fieldset key={index}>
          <legend>Group {index + 1}</legend>
          <label className="field">
            <span>Group identifier {index + 1}</span>
            <input
              value={group.key}
              maxLength={60}
              onChange={(e) =>
                setGroups((old) =>
                  old.map((g, i) =>
                    i === index ? { ...g, key: e.target.value } : g,
                  ),
                )
              }
            />
          </label>
          <label className="field">
            <span>Group name {index + 1}</span>
            <input
              value={group.name}
              maxLength={80}
              onChange={(e) =>
                setGroups((old) =>
                  old.map((g, i) =>
                    i === index ? { ...g, name: e.target.value } : g,
                  ),
                )
              }
            />
          </label>
          {data.teams.map((t) => (
            <label className="checkbox-row" key={t.id}>
              <input
                type="checkbox"
                checked={group.teamIds.includes(t.id)}
                onChange={(e) =>
                  setGroups((old) =>
                    old.map((g, i) =>
                      i === index
                        ? {
                            ...g,
                            teamIds: e.target.checked
                              ? [...g.teamIds, t.id]
                              : g.teamIds.filter((id) => id !== t.id),
                          }
                        : g,
                    ),
                  )
                }
              />
              <span>{t.name}</span>
            </label>
          ))}
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setGroups((old) => old.filter((_, i) => i !== index))
            }
          >
            Remove group {index + 1}
          </button>
        </fieldset>
      ))}
      <button
        type="button"
        className="secondary"
        onClick={() =>
          setGroups((old) => [...old, { key: "", name: "", teamIds: [] }])
        }
      >
        Add group
      </button>
      <label className="checkbox-row">
        <input
          type="checkbox"
          checked={published}
          onChange={(e) => setPublished(e.target.checked)}
        />
        <span>Publish approved group assignments</span>
      </label>
      <ConfirmMutation
        label="Save group assignments"
        title="Save approved Group Stage configuration?"
        description="This updates the group membership used by public standings when published. Scores remain governed by reviewed results and the configured round ranking rules."
        url={`/api/admin/tournaments/${slug}/matches`}
        payload={{
          action: "stage_groups",
          stageId: stage.id,
          expectedVersion: stage.version,
          configuration: groups.length ? { version, groups } : null,
          published,
          confirmed: true,
        }}
      />
    </details>
  );
}
export function FixtureManager({
  slug,
  data,
}: {
  slug: string;
  data: FixtureWorkspace;
}) {
  const [stage, setStage] = useState("");
  const matches = data.fixtures.filter(
    (f) =>
      !stage ||
      data.rounds.find((r) => r.round.id === f.roundId)?.stage === stage,
  );
  return (
    <div className="stack">
      {data.canManage && (
        <div className="panel form-stack">
          <h2>Fixture configuration</h2>

          {data.rounds.length && data.teams.length >= 2 ? (
            <details>
              <summary>Create a fixture</summary>
              <FixtureForm slug={slug} data={data} />
            </details>
          ) : (
            <p className="notice">
              Configure competition rounds and finalize/publish at least two
              teams before scheduling.
            </p>
          )}
          {data.stages
            .filter((s) => s.kind === "group")
            .map((s) => (
              <StageGroups
                key={`${s.id}-${s.version}`}
                stage={s}
                slug={slug}
                data={data}
              />
            ))}
          {data.rounds.map((r) => (
            <details key={r.round.id}>
              <summary>{r.round.name}: approved competition rules</summary>
              <RoundRules
                key={`${r.round.id}-${r.round.version}`}
                slug={slug}
                entry={r}
              />
            </details>
          ))}
        </div>
      )}
      <label className="field">
        <span>Filter fixture stage</span>
        <select value={stage} onChange={(e) => setStage(e.target.value)}>
          <option value="">All stages</option>
          <option value="group">Group Stage</option>
          <option value="knockout">Knockout Stage</option>
        </select>
      </label>
      {!matches.length && (
        <p className="notice">
          {data.canManage
            ? "No matching fixtures configured."
            : "No matching fixtures assigned to you."}
        </p>
      )}
      {matches.map((f) => (
        <article className="panel form-stack" key={f.id}>
          <p className="eyebrow">
            {data.rounds.find((r) => r.round.id === f.roundId)?.round.name}
          </p>
          <h2>
            <Link
              className="text-link"
              href={`/admin/tournaments/${slug}/matches/${f.id}`}
            >
              {f.label} ↗
            </Link>
          </h2>
          <p>
            {data.teams.find((t) => t.id === f.homeTeamId)?.name ??
              "Team publication unavailable"}{" "}
            vs{" "}
            {data.teams.find((t) => t.id === f.awayTeamId)?.name ??
              "Team publication unavailable"}
          </p>
          <p className="muted">
            {f.scheduledAt
              ? `${f.scheduledAt.toISOString()} · display ${f.timeZone}`
              : "Time TBA"}{" "}
            · {f.status.replaceAll("_", " ")}
          </p>
          <p>
            <span className="badge">
              {f.publishedAt ? "Published fixture" : "Unpublished fixture"}
            </span>{" "}
            · {f.result ? `${f.result.state} report` : "No result submitted"}
          </p>
          <p className="small muted">
            Assigned referees: {f.refereeIds.join(", ") || "None"} · v
            {f.version}
          </p>
          {data.canManage && (
            <>
              <ConfirmMutation
                label={f.publishedAt ? "Unpublish fixture" : "Publish fixture"}
                title={
                  f.publishedAt
                    ? "Withdraw fixture publication?"
                    : "Publish fixture schedule?"
                }
                description="This controls fixture visibility. Scores still require a separately approved and published result."
                url={`/api/admin/tournaments/${slug}/matches`}
                payload={{
                  action: "publish",
                  fixtureId: f.id,
                  expectedVersion: f.version,
                  published: !f.publishedAt,
                  confirmed: true,
                }}
              />
              {!f.publishedAt && (
                <details>
                  <summary>Amend fixture and referees</summary>
                  <FixtureForm
                    key={`${f.id}-${f.version}`}
                    slug={slug}
                    data={data}
                    fixture={f}
                  />
                </details>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
