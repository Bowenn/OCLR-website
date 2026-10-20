import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff, staffAccess, permits } from "@/lib/auth/staff";
import { tournamentForAdmin, tournamentList } from "@/lib/tournaments";
import { HttpError } from "@/lib/http";
import { PageHeading } from "@/components/ui";
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
        <PageHeading eyebrow="TOURNAMENT DASHBOARD" title={row.name}>
          {row.season ? `Season ${row.season} · ` : ""}
          {row.published ? "Published" : "Draft"} · {row.status} ·{" "}
          {row.timeZone}
        </PageHeading>
        <div className="actions">
          {primary && (
            <Link className="button" href={primary.href}>
              {data
                ? "Configure tournament"
                : `Open ${primary.label.toLowerCase()}`}{" "}
              →
            </Link>
          )}
          {row.published && (
            <Link className="text-link" href={`/tournaments/${slug}`}>
              View public tournament ↗
            </Link>
          )}
        </div>
        <section className="panel spaced">
          <h2>Registration</h2>
          <p className="muted small">
            {row.registration ? row.registrationState : "Not configured"}
            {data
              ? ` · ${data.applications} application${data.applications === 1 ? "" : "s"}`
              : ""}
          </p>
          {data && (
            <>
              <ul className="readiness-list">
                {data.readiness.map((item) => (
                  <li key={item.label}>
                    {item.ready ? "Ready" : "Pending"} · {item.label}
                  </li>
                ))}
              </ul>
              <p className="muted small">
                Publication and registration are separate. Registration remains
                closed until its approved prerequisites and window are ready.
              </p>
            </>
          )}
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
