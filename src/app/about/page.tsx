import Link from "next/link";
import { Action, PageHeading } from "@/components/ui";
import { site } from "@/content/site";
export const metadata = { title: "About OCLR" };
export default function About() {
  return (
    <div className="container page">
      <PageHeading
        eyebrow="THE ROOKIE STAGE"
        title="osu! Chinese League Rookie"
      >
        Individual players. A shared team story.
      </PageHeading>
      <div className="about-layout">
        <article className="prose">
          <h2>Made for the osu! community.</h2>
          <p className="muted">
            OCLR is an osu! community tournament. Players apply individually
            using their osu! identity; authorized staff review applications and
            appoint team captains.
          </p>
          <h2>From individual entry to team competition.</h2>
          <p className="muted">
            Eligible players enter a captain-turn draft. The active captain can
            select directly, and authorized staff can record a pick on that
            captain’s behalf. Both methods follow the same authoritative turn
            sequence.
          </p>
          <p className="muted">
            Once rosters are finalized and published, the teams enter the
            competition. Edition pages contain the approved rules, eligibility
            requirements and dates.
          </p>
          <div className="actions">
            <Action href="/tournaments">Explore tournaments →</Action>
            <Action href="/news" secondary>
              Latest announcements
            </Action>
          </div>
        </article>
        <aside className="about-aside">
          <p className="eyebrow">KEEP IN TOUCH</p>
          <h2>Organizers & contact</h2>
          {site.contact ? (
            <p>
              <a href={site.contact.url} className="text-link">
                {site.contact.label} ↗
              </a>
            </p>
          ) : (
            <p className="muted">
              Organizer details and public contact methods have not yet been
              published.
            </p>
          )}
          <p className="small muted">
            For personal data requests, see the{" "}
            <Link className="text-link" href="/privacy">
              privacy notice
            </Link>
            .
          </p>
          <hr />
          <p className="small muted">
            OCLR is a community event and is not affiliated with or endorsed by
            osu!.
          </p>
        </aside>
      </div>
    </div>
  );
}
