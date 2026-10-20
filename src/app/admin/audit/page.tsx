import Link from "next/link";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { auditLog, auditModules, auditChanges } from "@/lib/audit";
import { tournamentList } from "@/lib/tournaments";
import { HttpError } from "@/lib/http";
import { PageHeading } from "@/components/ui";
import { AuditModuleTabs } from "@/components/audit-module-tabs";
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
        .filter(([key, value]) => key !== "page" && value !== "")
        .map(([key, value]) => [key, String(value)]),
    );
    const editionNames = new Map(editions.map((e) => [e.slug, e.name]));
    const moreFilters = Boolean(f.actor || f.action || f.from || f.to);
    return (
      <div className="audit-workspace">
        <PageHeading eyebrow="ADMINISTRATION" title="Audit log">
          Operation history within your authorized scope. All times are UTC.
        </PageHeading>
        <AuditModuleTabs
          value={f.module}
          query={query.toString()}
          items={[
            { value: "", label: "All activity" },
            ...auditModules.map((module) => ({
              value: module,
              label: module.charAt(0).toUpperCase() + module.slice(1),
            })),
          ]}
        />
        <section
          role="tabpanel"
          id="audit-modules-panel"
          aria-labelledby={`audit-modules-${f.module}`}
          tabIndex={0}
        >
          <form className="audit-filters" method="get" key={query.toString()}>
            <input type="hidden" name="module" value={f.module} />
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
            <div className="actions audit-filter-actions">
              <button className="secondary">Filter</button>
              {(f.edition || moreFilters) && (
                <Link
                  className="text-link small"
                  href={
                    f.module
                      ? `/admin/audit?module=${f.module}`
                      : "/admin/audit"
                  }
                  scroll={false}
                >
                  Reset filters
                </Link>
              )}
            </div>
            <details className="audit-more-filters" open={moreFilters}>
              <summary>More filters</summary>
              <div className="audit-filter-fields">
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
                  <span>Action type</span>
                  <input
                    name="action"
                    maxLength={80}
                    defaultValue={f.action}
                    placeholder="e.g. captain_appoint"
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
              </div>
            </details>
          </form>
          <div className="audit-list-heading">
            <p className="muted small">
              {data.total} event{data.total === 1 ? "" : "s"} · Page {f.page}
            </p>
            <span className="muted small">Newest first · UTC</span>
          </div>
          {data.rows.length > 0 ? (
            <>
              <div className="audit-columns muted" aria-hidden="true">
                <span>Time (UTC)</span>
                <span>Activity / entity</span>
                <span>Actor</span>
                <span>Tournament</span>
              </div>
              <ol className="audit-events" aria-label="Audit events">
                {data.rows.map((event) => {
                  const changes = auditChanges(event.before, event.after);
                  return (
                    <li key={event.id}>
                      <details className="audit-event" name="audit-event">
                        <summary className="audit-event-summary">
                          <time
                            className="audit-event-time"
                            dateTime={event.timestamp}
                            title={event.timestamp}
                          >
                            <span>{event.timestamp.slice(0, 10)}</span>
                            <span className="muted">
                              {event.timestamp.slice(11, 19)}
                            </span>
                          </time>
                          <span className="audit-event-activity">
                            <strong>{event.action.replaceAll("_", " ")}</strong>
                            <span className="muted">
                              {event.entityType.replaceAll("_", " ")} ·{" "}
                              {event.entityId}
                            </span>
                          </span>
                          <span className="audit-event-actor">
                            <span>
                              {event.username ??
                                (event.actorId
                                  ? "Removed account"
                                  : "System / removed account")}
                            </span>
                            {event.actorId && (
                              <span className="muted">
                                osu! ID {event.actorId}
                              </span>
                            )}
                          </span>
                          <span className="audit-event-edition muted">
                            {event.edition
                              ? (editionNames.get(event.edition) ??
                                event.edition)
                              : "Global"}
                          </span>
                          <span
                            className="audit-event-toggle"
                            aria-hidden="true"
                          >
                            ⌄
                          </span>
                        </summary>
                        <div className="audit-event-detail">
                          <h2>
                            {changes.length === 20
                              ? "Up to 20 changed fields"
                              : `${changes.length} changed field${changes.length === 1 ? "" : "s"}`}
                          </h2>
                          {changes.length > 0 ? (
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
                          ) : (
                            <p className="muted small">
                              No before/after changes recorded.
                            </p>
                          )}
                          <details>
                            <summary>Raw details (redacted)</summary>
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
                        </div>
                      </details>
                    </li>
                  );
                })}
              </ol>
            </>
          ) : (
            <p className="notice small">No matching audit events.</p>
          )}
          <nav className="actions spaced" aria-label="Audit pages">
            {f.page > 1 && (
              <Link
                className="button secondary"
                href={`/admin/audit?${query}&page=${f.page - 1}`}
                scroll={false}
              >
                ← Previous
              </Link>
            )}
            {f.page * 25 < data.total && (
              <Link
                className="button secondary"
                href={`/admin/audit?${query}&page=${f.page + 1}`}
                scroll={false}
              >
                Next →
              </Link>
            )}
          </nav>
        </section>
      </div>
    );
  });
}
