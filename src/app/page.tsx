import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { Action } from "@/components/ui";
import { publicNewsContext } from "@/lib/public-news";
import { nextConfirmedMilestone } from "@/lib/public-milestones";
import { registrationAvailability } from "@/lib/registrations";
import { formatDate, publicEditionSummary } from "@/lib/editions";
export const dynamic = "force-dynamic";
export default async function Home() {
  const tr = await getAppTranslations();

  const now = new Date();
  const { editions, items } = await publicNewsContext(undefined, tr);
  const featured =
    editions.find((e) => e.status === "live") ??
    editions.find((e) => e.status === "upcoming") ??
    editions[0];
  const availability = featured
    ? await registrationAvailability(featured)
    : null;
  const summary = featured ? publicEditionSummary(featured.summary) : null;
  const news = items.slice(0, 3);
  const milestone = nextConfirmedMilestone(editions, now);
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div
          className="hero-art"
          style={{
            backgroundImage: `url("${featured?.branding.background ?? "/rookie-stage.svg"}")`,
          }}
          aria-hidden="true"
        />
        <div className="hero-shade" aria-hidden="true" />
        <div className="container hero-content">
          <div className="hero-meta">
            <p className="eyebrow hero-kicker">
              {"osu! Chinese League Rookie"}
            </p>
            {featured && (
              <span
                className="hero-status"
                data-state={featured.status}
                aria-label={tr("Tournament status")}
              >
                {tr(
                  {
                    upcoming: "Upcoming",
                    live: "Live",
                    completed: "Completed",
                  }[featured.status],
                )}
              </span>
            )}
          </div>
          <h1 id="hero-title">{featured?.name ?? "OCLR"}</h1>
          {summary && <p className="hero-copy">{summary}</p>}
          {!featured && (
            <p className="hero-copy">
              {tr("The next edition has not been announced yet.")}
            </p>
          )}
          {featured && availability !== "open" && (
            <p className="hero-enrollment">
              {availability === "upcoming"
                ? tr("Registration opens {value0}", {
                    value0: tr(
                      formatDate(
                        featured.registration?.opensAt ?? null,
                        featured.timeZone,
                        tr.locale,
                      ),
                    ),
                  })
                : availability === "paused"
                  ? tr("Registration paused")
                  : availability === "closed"
                    ? tr("Registration closed")
                    : availability === "unavailable"
                      ? tr("Registration temporarily unavailable")
                      : tr("Registration not announced")}
            </p>
          )}
          <div className="actions">
            {availability === "open" && (
              <Action href={`/tournaments/${featured!.slug}/register`}>
                {tr("Register")}
              </Action>
            )}
            <Action
              href={featured ? `/tournaments/${featured.slug}` : "/tournaments"}
              secondary={availability === "open"}
            >
              {featured ? tr("View tournament") : tr("Browse tournaments")}
            </Action>
          </div>
        </div>
      </section>
      <div className="container home-updates">
        <section aria-labelledby="latest-news-title">
          <div className="section-title">
            <h2 id="latest-news-title">{tr("Latest news")}</h2>
            <Action href="/news" secondary>
              {tr("All news")}
            </Action>
          </div>
          {news.length ? (
            <ol className="home-news">
              {news.map((item) => (
                <li key={item.slug}>
                  <p className="muted small">
                    {item.future ? tr("Scheduled for ") : ""}
                    {tr(formatDate(item.at, item.timeZone, tr.locale))}
                  </p>
                  <h3>
                    <Link className="news-headline" href={`/news/${item.slug}`}>
                      {item.title}
                    </Link>
                  </h3>
                  <p className="muted small">{item.summary}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">{tr("No announcements yet.")}</p>
          )}
        </section>
        <aside aria-labelledby="next-milestone-title">
          <p className="eyebrow">{tr("COMING UP")}</p>
          <h2 id="next-milestone-title">{tr("Next milestone")}</h2>
          {milestone ? (
            <>
              <p className="muted small">{milestone.edition}</p>
              <h3>{milestone.label}</h3>
              <p>
                {tr(formatDate(milestone.at, milestone.timeZone, tr.locale))}
              </p>
              <Action href={milestone.url} secondary>
                {tr("View schedule")}
              </Action>
            </>
          ) : (
            <p className="muted">
              {tr("No future milestone has been confirmed.")}
            </p>
          )}
        </aside>
      </div>
    </>
  );
}
