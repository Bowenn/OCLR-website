import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { staffAccess, permits } from "@/lib/auth/staff";
import { tournamentForAdmin, tournamentList } from "@/lib/tournaments";
import { HttpError } from "@/lib/http";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
import { TournamentEditor } from "@/components/tournament-editor";
export const metadata = { title: "Tournament workspace" };
export default async function Tournament({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const actor = await requireUser();
    const { edition: slug } = await params;
    const grants = await staffAccess(actor);
    const row = (await tournamentList(actor)).rows.find((r) => r.slug === slug);
    if (!row) throw new HttpError(404, "Tournament not found.");
    const data = permits(grants, "configure_tournament", slug)
      ? await tournamentForAdmin(actor, slug)
      : null;
    return (
      <>
        <PageHeading eyebrow="TOURNAMENT WORKSPACE" title={row.name}>
          {row.season ? `Season ${row.season} · ` : ""}
          {row.published ? "Published" : "Draft"} · {row.status} ·{" "}
          {row.timeZone}
        </PageHeading>
        <div className="actions">
          <Link className="button secondary" href="/admin/tournaments">
            All tournaments
          </Link>
          {row.published && (
            <Link className="button secondary" href={`/tournaments/${slug}`}>
              View public tournament ↗
            </Link>
          )}
        </div>
        <section className="section-space">
          <h2>Competition operations</h2>
          <nav className="actions spaced" aria-label="Tournament operations">
            {row.links
              .filter((l) => l.label !== "Tournament settings")
              .map((l) => (
                <Link className="button secondary" key={l.href} href={l.href}>
                  {l.label}
                </Link>
              ))}
          </nav>
        </section>
        {data ? (
          <>
            <section className="section-space panel">
              <div className="section-title">
                <h2>Registration readiness</h2>
                <span className="badge">Revision {data.revision}</span>
              </div>
              <p className="muted">
                {data.applications} applications ·{" "}
                {data.edition.registration?.enabled
                  ? "Registration enabled for the configured window"
                  : "Registration paused / unconfigured"}
              </p>
              <ul className="readiness-list">
                {data.readiness.map((item) => (
                  <li key={item.label}>
                    {item.ready ? "Ready" : "Pending"} · {item.label}
                  </li>
                ))}
              </ul>
              <p className="small muted">
                Tournament publication is independent. Missing registration
                prerequisites do not prevent announcing approved tournament
                information.
              </p>
            </section>
            <section className="section-space">
              <TournamentEditor
                data={{
                  edition: data.edition,
                  revision: data.revision,
                  applications: data.applications,
                  frozen: data.frozen,
                }}
              />
            </section>
            <details className="panel section-space">
              <summary>Recent tournament configuration history</summary>
              <ol className="schedule-list">
                {data.events.map((event) => (
                  <li key={event.id}>
                    <div>
                      <h3>
                        {event.kind
                          .replace("tournament_", "")
                          .replaceAll("_", " ")}
                      </h3>
                      <p className="muted small">
                        osu! ID {event.actorId ?? "system migration"} ·{" "}
                        {formatDate(event.createdAt, "UTC")}
                      </p>
                      <details>
                        <summary>Recorded changes</summary>
                        <pre className="audit-json">
                          {JSON.stringify(event.detail, null, 2)}
                        </pre>
                      </details>
                    </div>
                  </li>
                ))}
              </ol>
            </details>
          </>
        ) : (
          <p className="notice spaced">
            Your role grants access to the tools above. Tournament-wide settings
            are managed by an Admin.
          </p>
        )}
      </>
    );
  });
}
