import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { auditLog, auditModules, auditChanges } from "@/lib/audit";
import { tournamentList } from "@/lib/tournaments";
import { HttpError } from "@/lib/http";
import { PageHeading } from "@/components/ui";
export const metadata = { title: "Audit log" };
export default async function Audit({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    let data;
    try {
      data = await auditLog(actor, await searchParams);
    } catch (error) {
      if (!(error instanceof HttpError) || error.status !== 400) throw error;
      return (
        <>
          <PageHeading eyebrow="ADMINISTRATION" title="Audit log" />
          <p role="alert" className="notice error-text">
            {error.message}
          </p>
          <Link className="text-link" href="/admin/audit">
            Reset audit filters
          </Link>
        </>
      );
    }
    const editions = (await tournamentList(actor)).rows;
    const f = data.filters;
    const query = new URLSearchParams(
      Object.entries(f)
        .filter(([key]) => key !== "page")
        .map(([key, value]) => [key, String(value)]),
    );
    return (
      <>
        <PageHeading eyebrow="ADMINISTRATION" title="Audit log">
          Automatic operation history within your authorized scope. Dates are in
          UTC.
        </PageHeading>
        <form className="filters" method="get">
          <label className="field">
            <span>Tournament</span>
            <select
              aria-label="Tournament"
              name="edition"
              defaultValue={f.edition}
            >
              <option value="">All authorized tournaments</option>
              {editions.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Actor osu! ID</span>
            <input
              name="actor"
              inputMode="numeric"
              pattern="[1-9][0-9]*"
              defaultValue={f.actor}
            />
          </label>
          <label className="field">
            <span>Module</span>
            <select aria-label="Module" name="module" defaultValue={f.module}>
              <option value="">All modules</option>
              {auditModules.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Action type</span>
            <input
              name="action"
              maxLength={80}
              defaultValue={f.action}
              placeholder="e.g. tournament_general"
            />
          </label>
          <label className="field">
            <span>From (UTC)</span>
            <input type="date" name="from" defaultValue={f.from} />
          </label>
          <label className="field">
            <span>Through (UTC)</span>
            <input type="date" name="to" defaultValue={f.to} />
          </label>
          <button>Filter</button>
        </form>
        <p className="muted small">
          {data.total} event{data.total === 1 ? "" : "s"} · Page {f.page}
        </p>
        <div className="stack">
          {data.rows.map((event) => {
            const changes = auditChanges(event.before, event.after);
            return (
              <article className="panel" key={event.id}>
                <div className="section-title">
                  <h2>{event.action.replaceAll("_", " ")}</h2>
                  <time className="muted small" dateTime={event.timestamp}>
                    {event.timestamp.replace("T", " ").replace("Z", " UTC")}
                  </time>
                </div>
                <p className="small muted">
                  {event.username ??
                    (event.actorId
                      ? "Removed account"
                      : "System / removed account")}
                  {event.actorId ? ` · osu! ID ${event.actorId}` : ""} ·{" "}
                  {event.edition ?? "Global"}
                </p>
                <p className="small tournament-slug">
                  {event.entityType} · {event.entityId}
                </p>
                {changes.length > 0 && (
                  <details>
                    <summary>
                      {changes.length === 20
                        ? "Up to 20 changed fields"
                        : `${changes.length} changed field${changes.length === 1 ? "" : "s"}`}
                    </summary>
                    <dl className="detail-list">
                      {changes.map((change) => (
                        <div key={change.field}>
                          <dt>{change.field.replaceAll("_", " ")}</dt>
                          <dd>
                            {change.before} → {change.after}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </details>
                )}
                <details className="spaced">
                  <summary>Raw details (redacted and bounded)</summary>
                  <pre className="audit-json">
                    {JSON.stringify(
                      {
                        before: event.before,
                        after: event.after,
                        detail: event.details,
                      },
                      null,
                      2,
                    )}
                  </pre>
                </details>
              </article>
            );
          })}
        </div>
        {!data.rows.length && (
          <p className="notice small">No matching audit events.</p>
        )}
        <nav className="actions spaced" aria-label="Audit pages">
          {f.page > 1 && (
            <Link
              className="button secondary"
              href={`/admin/audit?${query}&page=${f.page - 1}`}
            >
              ← Previous
            </Link>
          )}
          {f.page * 25 < data.total && (
            <Link
              className="button secondary"
              href={`/admin/audit?${query}&page=${f.page + 1}`}
            >
              Next →
            </Link>
          )}
        </nav>
      </>
    );
  });
}
