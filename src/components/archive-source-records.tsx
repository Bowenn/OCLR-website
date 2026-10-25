import { getAppTranslations } from "@/i18n/server";
import type { HistoricalArchive } from "@/lib/historical-archive";

/** Name-only and replacement evidence has no account or current-membership link. */
export async function ArchiveRosterSources({
  archive: a,
  teamId,
  showSources = false,
}: {
  archive: HistoricalArchive;
  teamId?: string;
  showSources?: boolean;
}) {
  const tr = await getAppTranslations();
  const unresolved = (a.unresolvedPlayers ?? []).filter(
    (p) => !teamId || p.teamId === teamId,
  );
  const replacements = (a.rosterReplacements ?? []).filter(
    (p) => !teamId || p.teamId === teamId,
  );
  if (!unresolved.length && !replacements.length) return null;
  const teamName = (id: string) => a.teams.find((t) => t.id === id)!.name;
  return (
    <section className="stack">
      {showSources && <h2>{tr("Review source records")}</h2>}
      <ul>
        {unresolved.map((p) => (
          <li key={p.id}>
            <strong>{p.username}</strong> · {teamName(p.teamId)} ·{" "}
            {p.role === "captain"
              ? "Captain"
              : p.role === "coach"
                ? tr("Coach")
                : (p.sourceRole ??
                  (p.tier === null ? tr("Not recorded") : `Tier ${p.tier}`))}
            <div className="muted small">
              {tr("osu! ID ")}
              {tr("Not recorded")}
              {showSources ? ` · ${p.source}` : ""}
            </div>
          </li>
        ))}
        {replacements.map((r) => (
          <li key={r.id}>
            <strong>
              {teamName(r.teamId)} ·{" "}
              {r.tier === null ? tr("Not recorded") : `Tier ${r.tier}`}
            </strong>
            <p>{r.note}</p>
            <ul>
              {r.people.map((p, i) => (
                <li key={i}>
                  {p.username} · {tr("osu! ID ")}
                  {p.osuId ?? tr("Not recorded")}
                  {showSources ? ` · ${p.source}` : ""}
                </li>
              ))}
            </ul>
            {showSources && <p className="muted small">{r.source}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function ArchiveSourceRecords({
  archive: a,
}: {
  archive: HistoricalArchive;
}) {
  const tr = await getAppTranslations();
  if (
    !a.sourceFacts?.length &&
    !a.qualifiers?.length &&
    !a.reviewTables?.length
  )
    return null;
  return (
    <section className="stack">
      <h2>{tr("Historical source appendix")}</h2>
      {(a.sourceFacts ?? []).map((f, i) => (
        <details key={i}>
          <summary>{f.label}</summary>
          <p>{f.text}</p>
          <p className="muted small">{f.source}</p>
        </details>
      ))}
      {(a.reviewTables ?? []).map((t, i) => (
        <details key={`table-${i}`}>
          <summary>
            {t.name} · {tr("Unconfirmed records")}
          </summary>
          <p>{t.note}</p>
          <div
            className="table-scroll"
            role="region"
            aria-label={t.name}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  {[
                    tr("Team"),
                    tr("Wins"),
                    tr("Losses"),
                    tr("Maps won"),
                    tr("Maps lost"),
                  ].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.rows.map((r) => (
                  <tr key={r.teamId}>
                    <td>{a.teams.find((t) => t.id === r.teamId)!.name}</td>
                    <td>{r.wins}</td>
                    <td>{r.losses}</td>
                    <td>{r.mapsWon}</td>
                    <td>{r.mapsLost}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
      {(a.qualifiers ?? []).map((q, i) => (
        <details key={`qualifier-${i}`}>
          <summary>{q.name}</summary>
          <p className="muted small">{q.source}</p>
          <div
            className="table-scroll"
            role="region"
            aria-label={q.name}
            tabIndex={0}
          >
            <table>
              <thead>
                <tr>
                  <th>{tr("Players")}</th>
                  {a.pools
                    .find((p) => p.id === q.poolId)!
                    .maps.map((m) => (
                      <th key={m.slot}>{m.slot}</th>
                    ))}
                  <th>{tr("Source")}</th>
                </tr>
              </thead>
              <tbody>
                {q.records.map((r, n) => (
                  <tr key={n}>
                    <td>{r.username}</td>
                    {a.pools
                      .find((p) => p.id === q.poolId)!
                      .maps.map((m) => (
                        <td key={m.slot}>
                          {r.scores.find((s) => s.slot === m.slot)?.score ??
                            "—"}
                        </td>
                      ))}
                    <td>{r.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </section>
  );
}
