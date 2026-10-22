import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { registrationAvailability } from "@/lib/registrations";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { formatDate, publicEditionSummary } from "@/lib/editions";
import { publicCompetition } from "@/lib/public-competition";
import { publicMappools } from "@/lib/mappools";
import { publishedTeams } from "@/lib/teams";
import { Action, Badge } from "@/components/ui";
import { EventArtwork } from "@/components/event-artwork";
import { SeasonCountdown } from "@/components/season-countdown";
import { nextPlannedMilestone } from "@/lib/public-milestones";
import { publicParticipantCount } from "@/lib/players";
import { EligibilityLimitsSummary } from "@/components/eligibility-summary";
import { hasEligibilityLimits } from "@/lib/eligibility-model";
import { MatchCard, GroupStandings } from "@/components/public-matches";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  return { title: (await getPublicEdition(edition))?.name ?? "Tournament" };
}
export default async function Overview({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const now = new Date().getTime();
  const [state, [competitionResult, poolsResult, teamsResult, countResult]] =
    await Promise.all([
      registrationAvailability(edition),
      Promise.allSettled([
        publicCompetition(slug),
        publicMappools(slug),
        publishedTeams(slug),
        publicParticipantCount(slug),
      ]),
    ]);
  const competition =
    competitionResult.status === "fulfilled" ? competitionResult.value : null;
  const pools = poolsResult.status === "fulfilled" ? poolsResult.value : [];
  const teams = teamsResult.status === "fulfilled" ? teamsResult.value : [];
  const fixtures = competition?.fixtures ?? [];
  const upcoming = fixtures
    .filter((f) => !f.result && f.status !== "cancelled")
    .sort((a, b) =>
      (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999"),
    )
    .slice(0, 4);
  const latest = fixtures
    .filter((f) => f.result)
    .sort((a, b) => b.result!.updatedAt.localeCompare(a.result!.updatedAt))
    .slice(0, 4);
  const base = `/tournaments/${slug}`;
  const participantCount =
    countResult.status === "fulfilled" ? countResult.value : null;
  const hasCompetition = Boolean(
    upcoming.length ||
    latest.length ||
    competition?.groups.length ||
    pools.length,
  );
  const hasEligibility = Boolean(
    edition.eligibility || hasEligibilityLimits(edition.automaticEligibility),
  );
  const nextMilestone = nextPlannedMilestone(edition.schedule, now);
  const compactDate = (at: string | null) =>
    at
      ? new Intl.DateTimeFormat(tr.locale, {
          timeZone: edition.timeZone,
          dateStyle: "medium",
          timeStyle: "short",
          hourCycle: "h23",
        }).format(new Date(at))
      : tr("To be announced");
  return (
    <>
      <section
        className={`event-hero season-overview-hero${edition.branding.keyVisual ? " has-artwork" : ""}`}
        aria-labelledby="event-title"
      >
        <div className="event-intro">
          <p className="eyebrow season-lifecycle">{tr(edition.status)}</p>
          <h1 id="event-title">{edition.name}</h1>
          {publicEditionSummary(edition.summary) && (
            <p className="muted">{publicEditionSummary(edition.summary)}</p>
          )}
          <div className="actions">
            <Action
              href={`${base}/${state === "open" ? "register" : "schedule"}`}
            >
              {state === "open"
                ? tr("Register individually")
                : tr("View schedule")}
            </Action>
            <Action href={`${base}/mappools`} secondary>
              {tr("Explore mappools")}
            </Action>
          </div>
          <SeasonCountdown
            registration={
              edition.registration
                ? {
                    opensAt: edition.registration.opensAt,
                    closesAt: edition.registration.closesAt,
                    opensLabel: formatDate(
                      edition.registration.opensAt,
                      edition.timeZone,
                      tr.locale,
                    ),
                    closesLabel: formatDate(
                      edition.registration.closesAt,
                      edition.timeZone,
                      tr.locale,
                    ),
                  }
                : null
            }
            state={state}
            initialNow={now}
          />
        </div>
        {edition.branding.keyVisual && (
          <div className="season-hero-aside">
            <EventArtwork
              src={edition.branding.keyVisual}
              name={edition.name}
            />
          </div>
        )}
      </section>
      <section
        className="season-registration"
        aria-labelledby="season-registration-heading"
      >
        <div className="section-title season-registration-heading">
          <h2 id="season-registration-heading">{tr("Registration")}</h2>
          <Badge>{tr(state)}</Badge>
        </div>
        <div
          className={`season-registration-grid${edition.registration ? " has-registration-dates" : ""}`}
        >
          <div className="panel season-entry-summary">
            {participantCount !== null &&
              (edition.registration || participantCount > 0) && (
                <div className="season-player-count">
                  <strong>
                    {new Intl.NumberFormat(tr.locale).format(participantCount)}
                  </strong>
                  <div>
                    <span>{tr("Approved players")}</span>
                    <Link className="context-link" href={`${base}/players`}>
                      {tr("Players")} →
                    </Link>
                  </div>
                </div>
              )}
            {!edition.registration && (
              <p className="muted">{tr("Registration not announced")}</p>
            )}
            {hasEligibility && (
              <div className="season-eligibility">
                <h3>{tr("Eligibility")}</h3>
                {edition.eligibility && (
                  <p className="preserve-lines">{edition.eligibility}</p>
                )}
                {hasEligibilityLimits(edition.automaticEligibility) && (
                  <EligibilityLimitsSummary
                    limits={edition.automaticEligibility!}
                  />
                )}
              </div>
            )}
            <p className="muted small">
              {tr("Individual entry. Captain-led team draft.")}
            </p>
            {edition.rules && (
              <Link className="context-link" href={`${base}/rules`}>
                {tr("Read the rules")} →
              </Link>
            )}
          </div>
          {edition.registration && (
            <div className="panel season-registration-facts">
              <h3>{tr("Timeline")}</h3>
              <p className="muted small season-shared-zone">
                {edition.timeZone}
              </p>
              <dl className="detail-list">
                <div>
                  <dt>{tr("Opens")}</dt>
                  <dd>
                    <time dateTime={edition.registration.opensAt}>
                      {compactDate(edition.registration.opensAt)}
                    </time>
                  </dd>
                </div>
                <div>
                  <dt>{tr("Closes")}</dt>
                  <dd>
                    <time dateTime={edition.registration.closesAt}>
                      {compactDate(edition.registration.closesAt)}
                    </time>
                  </dd>
                </div>
                {edition.registration.withdrawUntil && (
                  <div>
                    <dt>{tr("Withdrawal deadline")}</dt>
                    <dd>
                      <time dateTime={edition.registration.withdrawUntil}>
                        {compactDate(edition.registration.withdrawUntil)}
                      </time>
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </section>
      {edition.schedule.length > 0 && (
        <section
          className="season-stages"
          aria-labelledby="season-stages-heading"
        >
          <div className="section-title">
            <h2 id="season-stages-heading">{tr("Tournament milestones")}</h2>
            <Link className="context-link" href={`${base}/schedule`}>
              {tr("Full schedule")} →
            </Link>
          </div>
          <p className="small muted">
            {tr("Planned milestones; dates do not confirm stage completion.")}
          </p>
          <ol
            className="event-milestones"
            tabIndex={0}
            aria-label={tr("Tournament milestones")}
          >
            {edition.schedule.map((event, i) => (
              <li key={i} data-next={i === nextMilestone || undefined}>
                <span className="event-step">{i + 1}</span>
                <div>
                  <strong>{event.label}</strong>
                  <p className="muted small">
                    {event.at ? (
                      <time dateTime={event.at}>{compactDate(event.at)}</time>
                    ) : (
                      tr("To be announced")
                    )}
                  </p>
                  {i === nextMilestone && (
                    <span className="small season-next-label">
                      {tr("Next milestone")}
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <p className="small muted season-shared-zone">{edition.timeZone}</p>
        </section>
      )}
      {[competitionResult, poolsResult, teamsResult, countResult].some(
        (r) => r.status === "rejected",
      ) && (
        <p className="notice" role="status">
          {tr(
            "Some competition information is temporarily unavailable. Please try again later.",
          )}
        </p>
      )}
      {(hasCompetition || teams.length > 0) && (
        <div
          className={`event-overview-grid${hasCompetition && teams.length ? " has-team-rail" : ""}${!hasCompetition ? " teams-only" : ""}${!hasCompetition && teams.length === 1 ? " single-team" : ""}`}
        >
          {hasCompetition && (
            <div className="event-overview-main">
              {upcoming.length > 0 && (
                <section aria-labelledby="upcoming-heading">
                  <div className="section-title">
                    <h2 id="upcoming-heading">{tr("Coming up")}</h2>
                    <Link className="context-link" href={`${base}/schedule`}>
                      {tr("Full schedule")}
                    </Link>
                  </div>
                  <div className="overview-matches">
                    {upcoming.map((f) => (
                      <MatchCard key={f.id} fixture={f} slug={slug} />
                    ))}
                  </div>
                </section>
              )}
              {latest.length > 0 && (
                <section aria-labelledby="latest-heading">
                  <div className="section-title">
                    <h2 id="latest-heading">{tr("Latest results")}</h2>
                    <Link className="context-link" href={`${base}/results`}>
                      {tr("All results")}
                    </Link>
                  </div>
                  <div className="overview-matches">
                    {latest.map((f) => (
                      <MatchCard key={f.id} fixture={f} slug={slug} />
                    ))}
                  </div>
                </section>
              )}
              {competition?.groups.length ? (
                <GroupStandings groups={competition.groups} slug={slug} />
              ) : null}
              {pools.length > 0 && (
                <section className="panel">
                  <div className="section-title">
                    <h2>{tr("Released mappools")}</h2>
                    <Link className="context-link" href={`${base}/mappools`}>
                      {tr("All mappools")}
                    </Link>
                  </div>
                  <ul className="event-pool-list">
                    {pools.slice(0, 4).map((pool) => (
                      <li key={pool.id}>
                        <Link href={`${base}/mappools/${pool.id}`}>
                          <span className="eyebrow">{pool.roundName}</span>
                          <strong>{pool.name}</strong>
                          <span className="muted small">
                            {pool.entries.length} {tr(" maps")}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          )}
          {teams.length > 0 && (
            <aside
              className="event-overview-aside"
              aria-label={tr("Tournament information")}
            >
              {teams.length > 0 && (
                <section className="panel">
                  <div className="section-title">
                    <h2>{tr("Teams")}</h2>
                    <Badge>{teams.length}</Badge>
                  </div>
                  <ul className="event-team-links">
                    {teams.slice(0, 6).map((t) => (
                      <li key={t.id}>
                        <Link
                          className="context-link"
                          href={`${base}/teams/${t.id}`}
                        >
                          {t.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link className="context-link" href={`${base}/teams`}>
                    {tr("Explore teams")}
                  </Link>
                </section>
              )}
            </aside>
          )}
        </div>
      )}
    </>
  );
}
