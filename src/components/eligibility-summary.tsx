import { useAppTranslations } from "@/i18n/shared";
import type { EligibilityVerification } from "@/lib/eligibility-model";
export function EligibilitySummary({
  value,
  currentRevision,
}: {
  value: EligibilityVerification;
  currentRevision?: number;
}) {
  const tr = useAppTranslations();
  return (
    <section
      className="eligibility-summary form-stack"
      aria-label={tr("Automatic eligibility")}
    >
      {currentRevision !== undefined &&
        currentRevision !== value.configurationVersion && (
          <p className="notice small">
            {tr(
              "Eligibility limits have changed since this verification. The saved decision is unchanged.",
            )}
          </p>
        )}
      <h3>
        {tr("Automatic eligibility")} · {"osu!standard"}
      </h3>
      <p
        className={`badge status-${value.status === "pass" ? "accepted" : value.status === "fail" ? "rejected" : "pending"}`}
      >
        {tr(
          value.status === "pass"
            ? "Pass"
            : value.status === "fail"
              ? "Does not meet"
              : value.status === "staff_override"
                ? "Staff override"
                : "Unable to verify",
        )}
      </p>
      {value.rankGraceRange && (
        <p className="notice small">
          {tr(
            "Submitted within the rank grace range for manual review. This is not an eligibility pass.",
          )}{" "}
          {value.rankGraceRange.minRank}–{value.rankGraceRange.maxRank}
        </p>
      )}
      <p>
        {"PP"}: {value.pp ?? "—"} · {tr("Global Rank")}: {value.rank ?? "—"}
      </p>
      <ul>
        {value.comparisons.map((c) => (
          <li key={c.field}>
            {c.field.endsWith("Pp") ? "PP" : tr("Global Rank")}{" "}
            {c.field.startsWith("min") ? "≥" : "≤"} {c.limit} ·{" "}
            {tr(
              c.passed === null
                ? "Unable to verify"
                : c.passed
                  ? "Pass"
                  : "Does not meet",
            )}
          </li>
        ))}
      </ul>
      <p className="small muted">
        {tr("Configuration revision")} {value.configurationVersion} ·{" "}
        {value.fetchedAt ? (
          <time dateTime={value.fetchedAt}>{value.fetchedAt}</time>
        ) : (
          "—"
        )}
      </p>
    </section>
  );
}

export function EligibilityLimitsSummary({
  limits,
}: {
  limits: import("@/lib/eligibility-model").EligibilityLimits;
}) {
  const tr = useAppTranslations();
  const entries = Object.entries(limits).filter(([, value]) => value !== null);
  return entries.length ? (
    <ul>
      {entries.map(([key, value]) => (
        <li key={key}>
          {key.endsWith("Pp") ? "PP" : tr("Global Rank")}{" "}
          {key.startsWith("min") ? "≥" : "≤"} {value}
        </li>
      ))}
    </ul>
  ) : (
    <p className="small muted">{tr("No automatic PP or rank restriction.")}</p>
  );
}
