import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { tournamentList } from "@/lib/tournaments";
import { formatDate } from "@/lib/editions";
import { PageHeading, EmptyState, Action } from "@/components/ui";
export const metadata = { title: "Tournament management" };
export default async function Tournaments({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string | string[];
    visibility?: string | string[];
  }>;
}) {
  return authorizedPage(async () => {
    const data = await tournamentList(await requireUser());
    const filters = await searchParams;
    const query = typeof filters.q === "string" ? filters.q.slice(0, 100) : "";
    const visibility =
      typeof filters.visibility === "string" ? filters.visibility : "";
    const q = query.toLowerCase();
    const rows = data.rows.filter(
      (r) =>
        (!q ||
          `${r.name} ${r.slug} ${r.season ?? ""}`.toLowerCase().includes(q)) &&
        (visibility !== "published" || r.published) &&
        (visibility !== "draft" || !r.published),
    );
    return (
      <>
        <PageHeading eyebrow="OCLR OPERATIONS" title="Tournament management">
          Create and configure editions, then open their competition tools.
        </PageHeading>
        <div className="actions">
          {data.canCreate && (
            <Action href="/admin/tournaments/new">Create tournament</Action>
          )}
        </div>
        <form className="filters spaced" method="get">
          <label className="field">
            <span>Search tournaments</span>
            <input name="q" maxLength={100} defaultValue={query} />
          </label>
          <label className="field">
            <span>Visibility</span>
            <select name="visibility" defaultValue={visibility}>
              <option value="">All assigned editions</option>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
            </select>
          </label>
          <button>Filter</button>
        </form>
        {rows.length ? (
          <div className="stack">
            {rows.map((r) => (
              <article className="panel" key={r.slug}>
                <div className="section-title">
                  <div>
                    <p className="eyebrow">
                      {r.season ? `Season ${r.season}` : r.slug}
                    </p>
                    <h2>{r.name}</h2>
                  </div>
                  <span className="badge">
                    {r.published ? "Published" : "Draft"} · {r.status}
                  </span>
                </div>
                <dl className="detail-list">
                  <div>
                    <dt>Registration</dt>
                    <dd>
                      {!r.registration ? "Not configured" : r.registrationState}
                    </dd>
                  </div>
                  <div>
                    <dt>Opens / closes</dt>
                    <dd>
                      {r.registration
                        ? `${formatDate(r.registration.opensAt, r.timeZone)} — ${formatDate(r.registration.closesAt, r.timeZone)}`
                        : "Not configured"}
                    </dd>
                  </div>
                  <div>
                    <dt>Last modified</dt>
                    <dd>{formatDate(r.updatedAt, r.timeZone)}</dd>
                  </div>
                </dl>
                <Link
                  className="button secondary"
                  href={`/admin/tournaments/${r.slug}`}
                >
                  Open tournament<span className="sr-only"> {r.name}</span> ↗
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState title="No matching tournaments">
            {data.canCreate
              ? "Create a private edition to begin, or clear the filters."
              : "Your authorized tournament workspaces will appear here when assigned."}
          </EmptyState>
        )}
      </>
    );
  });
}
