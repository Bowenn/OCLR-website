import Link from "next/link";
import { redirect } from "next/navigation";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff, staffAccess } from "@/lib/auth/staff";
import { listApplications, parseFilters } from "@/lib/staff";
import { tournamentList } from "@/lib/tournaments";
import { PageHeading, Action } from "@/components/ui";
export const metadata = { title: "Administration overview" };
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const params = await searchParams;
    if (["q", "edition", "status", "page"].some((key) => key in params)) {
      const filters = parseFilters(params);
      redirect(
        `/admin/registrations?${new URLSearchParams({ q: filters.q, edition: filters.edition, status: filters.status, page: String(filters.page) })}`,
      );
    }
    const access = await staffAccess(actor);
    const isAdmin = access.some((g) => g.role === "admin");
    const data = await tournamentList(actor);
    const pending = isAdmin
      ? await listApplications(actor, { status: "pending" })
      : null;
    return (
      <>
        <PageHeading eyebrow="OCLR OPERATIONS" title="Administration overview">
          {isAdmin
            ? "Choose a tournament to manage its configuration and competition."
            : "Open an assigned tournament to work with your authorized tools."}
        </PageHeading>
        <div className="actions">
          <Action href="/admin/tournaments">
            {isAdmin ? "Manage tournaments" : "Assigned tournaments"}
          </Action>
          {data.canCreate && (
            <Action href="/admin/tournaments/new" secondary>
              Create tournament
            </Action>
          )}
        </div>
        {pending && (
          <section className="panel spaced admin-task">
            <div>
              <h2>Registration review</h2>
              <p className="muted small">
                {pending.total} pending application
                {pending.total === 1 ? "" : "s"} across your authorized
                editions.
              </p>
            </div>
            <Link
              className="text-link"
              href="/admin/registrations?status=pending"
            >
              Review applications →
            </Link>
          </section>
        )}
        <section className="section-space">
          <h2>{isAdmin ? "Accessible tournaments" : "Your tournaments"}</h2>
          {data.rows.length ? (
            <div className="stack spaced">
              {data.rows.slice(0, 6).map((row) => (
                <article className="panel admin-task" key={row.slug}>
                  <div>
                    <h3>{row.name}</h3>
                    <p className="muted small">
                      {row.season ? `Season ${row.season} · ` : ""}
                      {row.status} · {row.published ? "Published" : "Draft"}
                    </p>
                  </div>
                  <Link
                    className="button secondary"
                    href={`/admin/tournaments/${row.slug}`}
                  >
                    Open tournament<span className="sr-only"> {row.name}</span>{" "}
                    →
                  </Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="notice small">
              {isAdmin
                ? "No tournaments yet. Create a private edition to begin."
                : "No tournaments have been assigned to you yet."}
            </p>
          )}
        </section>
      </>
    );
  });
}
