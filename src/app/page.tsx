import Link from "next/link";
import { Action, Badge } from "@/components/ui";
import { publicNewsContext } from "@/lib/public-news";
import { nextConfirmedMilestone } from "@/lib/public-milestones";
import { registrationAvailability } from "@/lib/registrations";
import { formatDate, publicEditionSummary } from "@/lib/editions";
export const dynamic = "force-dynamic";
export default async function Home() {
  const now = new Date();
  const { editions, items } = await publicNewsContext();
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
          <p className="eyebrow hero-kicker">osu! Chinese League Rookie</p>
          <h1 id="hero-title">{featured?.name ?? "OCLR"}</h1>
          {summary && <p className="hero-copy">{summary}</p>}
          {!featured && (
            <p className="hero-copy">
              The next edition has not been announced yet.
            </p>
          )}
          {featured && availability !== "open" && (
            <Badge>
              {availability === "upcoming"
                ? `Registration opens ${formatDate(featured.registration?.opensAt ?? null, featured.timeZone)}`
                : availability === "paused"
                  ? "Registration paused"
                  : availability === "closed"
                    ? "Registration closed"
                    : availability === "unavailable"
                      ? "Registration temporarily unavailable"
                      : "Registration not announced"}
            </Badge>
          )}
          <div className="actions">
            {availability === "open" && (
              <Action href={`/tournaments/${featured!.slug}/register`}>
                Register
              </Action>
            )}
            <Action
              href={featured ? `/tournaments/${featured.slug}` : "/tournaments"}
              secondary={availability === "open"}
            >
              {featured ? "View tournament" : "Browse tournaments"}
            </Action>
          </div>
        </div>
      </section>
      <div className="container home-updates">
        <section aria-labelledby="latest-news-title">
          <div className="section-title">
            <h2 id="latest-news-title">Latest news</h2>
            <Action href="/news" secondary>
              All news
            </Action>
          </div>
          {news.length ? (
            <ol className="home-news">
              {news.map((item) => (
                <li key={item.slug}>
                  <p className="muted small">
                    {item.future ? "Scheduled for " : ""}
                    {formatDate(item.at, item.timeZone)}
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
            <p className="muted">No announcements yet.</p>
          )}
        </section>
        <aside aria-labelledby="next-milestone-title">
          <p className="eyebrow">COMING UP</p>
          <h2 id="next-milestone-title">Next milestone</h2>
          {milestone ? (
            <>
              <p className="muted small">{milestone.edition}</p>
              <h3>{milestone.label}</h3>
              <p>{formatDate(milestone.at, milestone.timeZone)}</p>
              <Action href={milestone.url} secondary>
                View schedule
              </Action>
            </>
          ) : (
            <p className="muted">No future milestone has been confirmed.</p>
          )}
        </aside>
      </div>
    </>
  );
}
