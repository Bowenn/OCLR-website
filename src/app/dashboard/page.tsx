import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/user";
import { playerApplications, statusCopy } from "@/lib/dashboard";
import { formatDate } from "@/lib/editions";
import { Action, EmptyState, PageHeading } from "@/components/ui";
import { Avatar } from "@/components/avatar";
import { ConfirmMutation } from "@/components/confirm-mutation";
export const metadata = {
  title: "Player dashboard",
  robots: { index: false, follow: false },
};
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ submitted?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const applications = await playerApplications(user.osuId);
  const params = await searchParams;
  return (
    <div className="container page workspace">
      <aside className="sidebar">
        <p className="eyebrow">PLAYER CENTER</p>
        <h2>Your OCLR</h2>
        <nav aria-label="Player navigation">
          <Link href="/dashboard">Dashboard</Link>
          <a href="#identity">My identity</a>
          <a href="#registrations">My registrations</a>
          <Link href="/tournaments">Tournaments</Link>
        </nav>
        <form className="spaced" action="/auth/logout" method="post">
          <button className="secondary">Sign out</button>
        </form>
      </aside>
      <div className="workspace-main">
        <PageHeading eyebrow="YOUR ROOKIE STAGE" title="Player dashboard">
          Your identity and tournament applications, in one place.
        </PageHeading>
        {params.submitted && (
          <p className="notice" role="status">
            Application submitted. Your saved status appears below.
          </p>
        )}
        <section
          className="panel identity-panel"
          id="identity"
          aria-label="osu! identity"
        >
          <Avatar osuId={user.osuId} username={user.username} />
          <div>
            <p className="eyebrow">OSU! IDENTITY</p>
            <h2>
              <a
                href={`https://osu.ppy.sh/users/${user.osuId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {user.username}{" "}
                <span
                  className="muted"
                  aria-label="opens osu! profile in a new tab"
                >
                  ↗
                </span>
              </a>
            </h2>
            <p className="muted">osu! ID: {user.osuId}</p>
          </div>
          <span className="badge">Connected with osu!</span>
        </section>
        <section className="section-space" id="registrations">
          <div className="section-title">
            <h2>My registrations</h2>
            <Link href="/tournaments" className="text-link">
              Browse tournaments ↗
            </Link>
          </div>
          {applications.length ? (
            <div className="stack">
              {applications.map(
                ({
                  registration: r,
                  edition,
                  withdrawable,
                  captainAssigned,
                  acknowledgedConfiguration,
                }) => (
                  <article className="panel registration-card" key={r.id}>
                    <div className="registration-cover" aria-hidden="true">
                      OCLR
                    </div>
                    <div className="registration-details">
                      <div className="section-title">
                        <h3>{edition?.name ?? `Edition: ${r.editionSlug}`}</h3>
                        <span className={`badge status-${r.status}`}>
                          {r.status}
                        </span>
                      </div>
                      <p className="muted small">{statusCopy[r.status]}</p>
                      <p className="small muted">
                        Submitted{" "}
                        {formatDate(r.createdAt, edition?.timeZone ?? "UTC")}
                      </p>
                      {r.statusReason && (
                        <p className="notice small">
                          Staff explanation: {r.statusReason}
                        </p>
                      )}
                      <p className="muted small">
                        Acknowledged rules: {r.rulesVersion}. Existing
                        acknowledgments remain associated with their saved
                        version.
                      </p>
                      {acknowledgedConfiguration?.rules && (
                        <details className="spaced">
                          <summary>
                            My acknowledged rules and application
                          </summary>
                          {acknowledgedConfiguration.rules.sections.map(
                            (s, i) => (
                              <section key={i}>
                                <h4>{s.heading}</h4>
                                <p className="preserve-lines small">{s.body}</p>
                              </section>
                            ),
                          )}
                          <p className="preserve-lines small">
                            {acknowledgedConfiguration.eligibility}
                          </p>
                          <dl className="detail-list">
                            {Object.entries(r.answers).map(([key, value]) => (
                              <div key={key}>
                                <dt>
                                  {acknowledgedConfiguration.registration?.questions.find(
                                    (q) => q.id === key,
                                  )?.label ?? key}
                                </dt>
                                <dd className="preserve-lines">
                                  {value || "No answer"}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </details>
                      )}
                      <div className="actions">
                        {edition && captainAssigned && (
                          <>
                            <Action
                              href={`/tournaments/${edition.slug}/team`}
                              secondary
                            >
                              My captain team
                            </Action>
                            <Action
                              href={`/tournaments/${edition.slug}/draft/captain`}
                            >
                              Captain draft room
                            </Action>
                          </>
                        )}
                        {edition && (
                          <Action
                            href={`/tournaments/${edition.slug}`}
                            secondary
                          >
                            Edition details
                          </Action>
                        )}
                        {withdrawable && (
                          <ConfirmMutation
                            label="Withdraw application"
                            title="Withdraw your application?"
                            description="This removes your application from consideration. You cannot resubmit automatically. Contact staff if you need help."
                            url={`/api/registrations/${r.id}/withdraw`}
                            payload={{ confirmed: true }}
                          />
                        )}
                      </div>
                    </div>
                  </article>
                ),
              )}
            </div>
          ) : (
            <EmptyState title="Your stage starts here.">
              You have no applications yet. Browse the tournaments and apply
              individually when registration is open.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}
