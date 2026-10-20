import { authorizedPage } from "@/lib/auth/page";
import Link from "next/link";
import { requireStaff, staffAccess, permits } from "@/lib/auth/staff";
import { listApplications } from "@/lib/staff";
import { getEditions } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { EmptyState, PageHeading } from "@/components/ui";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const access = await staffAccess(actor);
    if (!access.some((g) => g.role === "admin"))
      return (
        <>
          <PageHeading eyebrow="STAFF WORKSPACE" title="OCLR operations">
            Your assignments grant access to specific operational tools.
          </PageHeading>
          <div className="panel">
            <h2>Your role assignments</h2>
            {access.map((g, i) => (
              <p key={i}>
                {g.role} · {g.editionSlug ?? "All editions"}
              </p>
            ))}
            <p className="muted">
              Tools appear in the workspace navigation as they become available.
              Captain draft access remains separate.
            </p>
          </div>
        </>
      );
    const result = await listApplications(actor, await searchParams);
    const { rows, total, filters } = result;
    const query = new URLSearchParams({
      q: filters.q,
      edition: filters.edition,
      status: filters.status,
    });
    const editions = (await getEditions()).filter((e) =>
      permits(access, "manage_registrations", e.slug),
    );
    return (
      <>
        <PageHeading eyebrow="REGISTRATION REVIEW" title="Registrations">
          Review individual applications. Acceptance does not appoint a captain
          or assign a team.
        </PageHeading>
        <div className="actions">
          <Link className="button secondary" href="/admin/tournaments">
            Tournament management →
          </Link>
        </div>
        <div className="section-title">
          <p className="muted small">
            {total} matching application{total === 1 ? "" : "s"}
          </p>
          <a
            className="button secondary"
            href={`/api/admin/registrations/export?${query}`}
          >
            Export CSV ↓
          </a>
        </div>
        <form className="filters" action="/admin" method="get">
          <label className="field">
            <span>Search player or osu! ID</span>
            <input
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder="Username or stable osu! ID"
            />
          </label>
          <label className="field">
            <span>Edition</span>
            <select name="edition" defaultValue={filters.edition}>
              <option value="">All editions</option>
              {editions.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Status</span>
            <select name="status" defaultValue={filters.status}>
              <option value="">All statuses</option>
              {["pending", "accepted", "rejected", "withdrawn"].map(
                (status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ),
              )}
            </select>
          </label>
          <button type="submit">Filter</button>
        </form>
        {rows.length ? (
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label="Registration table; scroll horizontally on small screens"
          >
            <table>
              <caption className="sr-only">
                Private registration review, page {filters.page}
              </caption>
              <thead>
                <tr>
                  {[
                    "Player",
                    "osu! ID",
                    "Edition",
                    "Status",
                    "Submitted",
                    "Review",
                  ].map((h) => (
                    <th key={h} scope="col">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td>{r.username}</td>
                    <td>{r.userId}</td>
                    <td>
                      {editions.find((e) => e.slug === r.editionSlug)?.name ??
                        r.editionSlug}
                    </td>
                    <td>
                      <span className={`badge status-${r.status}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{formatDate(r.createdAt, "UTC")}</td>
                    <td>
                      <Link
                        className="text-link"
                        href={`/admin/registrations/${r.id}`}
                      >
                        Review<span className="sr-only"> {r.username}</span> ↗
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="No matching applications">
            Try another search or wait for registration to open.
          </EmptyState>
        )}
        <nav aria-label="Application pages" className="actions spaced">
          {filters.page > 1 && (
            <Link
              className="button secondary"
              href={`/admin?${query}&page=${filters.page - 1}`}
            >
              ← Previous
            </Link>
          )}
          {filters.page * 25 < total && (
            <Link
              className="button secondary"
              href={`/admin?${query}&page=${filters.page + 1}`}
            >
              Next →
            </Link>
          )}
        </nav>
      </>
    );
  });
}
