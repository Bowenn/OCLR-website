import { useAppTranslations } from "@/i18n/shared";
import type { BwsSummary as Summary } from "@/lib/bws-model";
import { modeNames } from "@/lib/osu-profile-model";
export function BwsSummary({ value }: { value: Summary }) {
  const tr = useAppTranslations();
  return (
    <section className="bws-summary" aria-label={tr("Badge-weighted seeding")}>
      <h3>
        {tr("BWS adjusted seed")}{" "}
        <span className="muted small">· {modeNames[value.mode]}</span>
      </h3>
      {value.value !== null ? (
        <p>
          <strong className="bws-value">
            {new Intl.NumberFormat(tr.locale, {
              maximumFractionDigits: 0,
            }).format(value.value)}
          </strong>{" "}
          <span className="muted small">
            {tr("Eligible tournament badges: {count}", {
              count: value.badgeCount!,
            })}
          </span>
        </p>
      ) : (
        <p className="muted" role="status">
          {value.status === "unranked"
            ? tr("Unranked / unavailable")
            : tr("Badge eligibility pending staff review")}
        </p>
      )}
      <p className="small muted">
        {tr(
          "Informational for the selected ruleset, not a leaderboard position or registration decision.",
        )}{" "}
        <a
          className="text-link"
          href="https://osu.ppy.sh/wiki/en/Tournaments/Badge-weighted_seeding"
        >
          {tr("BWS formula")}
        </a>
      </p>
      <p className="small muted">
        {value.reviewedAt
          ? tr("Staff-reviewed badge classification")
          : value.badgeCount === 0
            ? tr("Provider returned no profile badges")
            : tr("Tournament badge types are not supplied by osu!")}
        {value.reviewedAt && (
          <>
            {" "}
            · <time dateTime={value.reviewedAt}>{value.reviewedAt}</time>
          </>
        )}
      </p>
      <p className="small muted">
        {tr("Profile updated")}{" "}
        <time dateTime={value.fetchedAt}>{value.fetchedAt}</time>
        {value.status === "stale" && <> · {tr("Stale snapshot")}</>}
      </p>
    </section>
  );
}
