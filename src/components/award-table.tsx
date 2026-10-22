"use client";
import { useAppTranslations } from "@/i18n/shared";
import { awardPercentage, type AwardCandidate } from "@/lib/award-model";
export function AwardTable({
  candidates,
  mvp,
  mip,
  rookie,
}: {
  candidates: (AwardCandidate & { username: string })[];
  mvp: number[];
  mip: number[];
  rookie: number[];
}) {
  const tr = useAppTranslations();
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>{tr("Player")}</th>
            <th>{tr("Tier")}</th>
            <th>{tr("Appearances")}</th>
            <th>{tr("Weekly performance")}</th>
            <th>{tr("Previous week")}</th>
            <th>{tr("Improvement")}</th>
            <th>{tr("Awards")}</th>
            <th>{tr("Eligibility")}</th>
          </tr>
        </thead>
        <tbody>
          {candidates.map((row) => (
            <tr key={row.userId}>
              <th>
                <a
                  href={`https://osu.ppy.sh/users/${row.userId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {row.username}
                </a>
              </th>
              <td>{row.tier === null ? "—" : `T${row.tier}`}</td>
              <td>{row.appearances}</td>
              <td>{awardPercentage(row.performance)}</td>
              <td>
                {row.previousPerformance === null
                  ? "—"
                  : `${awardPercentage(row.previousPerformance)} (${row.previousAppearances})`}
              </td>
              <td>
                {row.improvement === null
                  ? "—"
                  : `${row.improvement > 0 ? "+" : ""}${awardPercentage(row.improvement)}`}
              </td>
              <td>
                {[
                  ["MVP", mvp],
                  ["MIP", mip],
                  [tr("Best Rookie"), rookie],
                ]
                  .flatMap(([name, ids]) =>
                    (ids as number[]).includes(row.userId)
                      ? [
                          `${name}${(ids as number[]).length > 1 ? ` (${tr("Tied")})` : ""}`,
                        ]
                      : [],
                  )
                  .join(" · ") || "—"}
              </td>
              <td className="small">
                {tr("MVP: {value0}/6 appearances", { value0: row.appearances })}
                <br />
                {tr(
                  "MIP: {value0}/5 current, {value1}/5 previous; positive gain required",
                  { value0: row.appearances, value1: row.previousAppearances },
                )}
                <br />
                {tr("Rookie: {value0}/5 appearances; Tier T4/T5+ required", {
                  value0: row.appearances,
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {!candidates.length && (
        <p className="muted">{tr("No eligible appearances in this week.")}</p>
      )}
    </div>
  );
}
