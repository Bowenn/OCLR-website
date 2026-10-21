import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { authorizedPage } from "@/lib/auth/page";
import type { User } from "@/lib/auth/sessions";
import { permits, staffAccess } from "@/lib/auth/staff";
import { listApplications } from "@/lib/staff";
import { getEditions } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export async function RegistrationList({
  actor,
  editionSlug,
  filtersInput,
}: {
  actor: User;
  editionSlug?: string;
  filtersInput: Record<string, string | string[] | undefined>;
}) {
  return authorizedPage(async () => {
    const access = await staffAccess(actor);
    const result = await listApplications(
      actor,
      editionSlug ? { ...filtersInput, edition: editionSlug } : filtersInput,
    );
    const { rows, total, filters } = result;
    const basePath = editionSlug
      ? `/admin/tournaments/${editionSlug}/registrations`
      : "/admin/registrations";
    const query = new URLSearchParams({
      q: filters.q,
      edition: filters.edition,
      status: filters.status,
    });
    const editions = (await getEditions()).filter((e) =>
      permits(access, "manage_registrations", e.slug),
    );
    return (
      <section
        className={`registration-review${editionSlug ? " edition-registration-review" : ""}`}
      >
        <PageHeading eyebrow="REGISTRATION REVIEW" title="Registrations">
          Acceptance does not appoint a captain or assign a team.
        </PageHeading>
        <div className="section-title">
          <p className="muted small">
            {total} matching application{total === 1 ? "" : "s"}
          </p>
          {total > 0 && (
            <a
              className="button secondary"
              href={`/api/admin/registrations/export?${query}`}
            >
              Export CSV ↓
            </a>
          )}
        </div>
        <form className="filters" action={basePath} method="get">
          <label className="field">
            <span>Search player or osu! ID</span>
            <input
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder="Username or stable osu! ID"
            />
          </label>
          {!editionSlug && (
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
          )}
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
                    ...(!editionSlug ? ["Edition"] : []),
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
                    <td>
                      <div className="registration-player">
                        <Avatar osuId={r.userId} username={r.username} />
                        <span>{r.username}</span>
                      </div>
                    </td>
                    <td>{r.userId}</td>
                    {!editionSlug && (
                      <td>
                        {editions.find((e) => e.slug === r.editionSlug)?.name ??
                          r.editionSlug}
                      </td>
                    )}
                    <td>
                      <span className={`badge status-${r.status}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>{formatDate(r.createdAt, "UTC")}</td>
                    <td>
                      <Link
                        className="button secondary"
                        href={`/admin/tournaments/${r.editionSlug}/registrations/${r.id}`}
                      >
                        Review<span className="sr-only"> {r.username}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="notice small">
            {filters.q || filters.status
              ? "No matching registrations."
              : "No registrations yet."}
          </p>
        )}
        <nav aria-label="Application pages" className="actions spaced">
          {filters.page > 1 && (
            <Link
              className="button secondary"
              href={`${basePath}?${query}&page=${filters.page - 1}`}
            >
              ← Previous
            </Link>
          )}
          {filters.page * 25 < total && (
            <Link
              className="button secondary"
              href={`${basePath}?${query}&page=${filters.page + 1}`}
            >
              Next →
            </Link>
          )}
        </nav>
      </section>
    );
  });
}
