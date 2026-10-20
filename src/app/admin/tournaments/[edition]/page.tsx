import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff, staffAccess, permits } from "@/lib/auth/staff";
import { tournamentForAdmin, tournamentList } from "@/lib/tournaments";
import { HttpError } from "@/lib/http";
import { formatDate } from "@/lib/editions";
export const metadata = { title: "Tournament dashboard" };
export default async function Tournament({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { edition: slug } = await params;
    const grants = await staffAccess(actor);
    const row = (await tournamentList(actor)).rows.find((r) => r.slug === slug);
    if (!row) throw new HttpError(404, "Tournament not found.");
    const data = permits(grants, "configure_tournament", slug)
      ? await tournamentForAdmin(actor, slug)
      : null;
    const primary = data
      ? row.links.find((link) => link.label === "Settings")
      : row.links.find((link) => link.group === "Competition");
    return (
      <>
        <header className="tournament-dashboard-heading">
          <div>
            <p className="eyebrow">TOURNAMENT DASHBOARD</p>
            <h1>{row.name}</h1>
          </div>
          <div className="actions">
            {primary && (
              <Link
                className={`button${data ? " secondary" : ""}`}
                href={primary.href}
              >
                {data
                  ? "Configure tournament"
                  : `Open ${primary.label.toLowerCase()}`}{" "}
                <span aria-hidden="true">→</span>
              </Link>
            )}
            {row.published && (
              <Link
                className="button secondary button-compact"
                href={`/tournaments/${slug}`}
              >
                View public tournament <span aria-hidden="true">↗</span>
              </Link>
            )}
          </div>
        </header>
        <section
          className="registration-readiness"
          aria-labelledby="registration-heading"
        >
          <div className="registration-readiness-header">
            <h2 id="registration-heading">Registration</h2>
            <div className="registration-summary">
              <span
                className={`badge registration-state state-${row.registrationState}`}
              >
                {row.registration ? row.registrationState : "Not configured"}
              </span>
              {data && (
                <Link
                  className="button secondary button-compact"
                  href={`/admin/tournaments/${slug}/registrations`}
                >
                  View applications ({data.applications})
                </Link>
              )}
            </div>
          </div>
          <div
            className={`registration-overview-body${data ? "" : " is-single"}`}
          >
            <div>
              <h3>Registration window</h3>
              {row.registration ? (
                <dl className="registration-window">
                  <div>
                    <dt>Opens</dt>
                    <dd>
                      {formatDate(row.registration.opensAt, row.timeZone)}
                    </dd>
                  </div>
                  <div>
                    <dt>Closes</dt>
                    <dd>
                      {formatDate(row.registration.closesAt, row.timeZone)}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="muted small">
                  Registration dates have not been configured.
                </p>
              )}
              <p className="registration-timezone">Time zone: {row.timeZone}</p>
            </div>
            {data && (
              <div>
                <h3>Registration checks</h3>
                <ul className="readiness-list">
                  {data.readiness.map((item) => (
                    <li key={item.label}>
                      <span>{item.label}</span>
                      <span className="readiness-outcome">
                        {!item.ready && item.label === "Registration dates" && (
                          <Link
                            className="button secondary button-compact"
                            href={`/admin/tournaments/${slug}/settings?section=registration`}
                          >
                            Configure
                            <span className="sr-only"> registration dates</span>
                          </Link>
                        )}
                        <span
                          className={
                            item.ready ? "readiness-ready" : "readiness-pending"
                          }
                        >
                          {item.ready ? "Ready" : "Pending"}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <p className="registration-guidance">
            Applications are accepted during this window when registration is
            enabled.
          </p>
        </section>
        {!data && (
          <p className="notice small spaced">
            Use your tournament navigation to open authorized tools.
            Tournament-wide settings are managed by an Admin.
          </p>
        )}
      </>
    );
  });
}
