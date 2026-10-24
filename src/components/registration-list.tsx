import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { Avatar } from "@/components/avatar";
import { authorizedPage } from "@/lib/auth/page";
import type { User } from "@/lib/auth/sessions";
import { permits, staffAccess } from "@/lib/auth/staff";
import { listApplications } from "@/lib/staff";
import { getEditions } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { ManualRegistration } from "./manual-registration";
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
  const tr = await getAppTranslations();

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
        <PageHeading
          eyebrow={tr("REGISTRATION REVIEW")}
          title={tr("Registrations")}
        >
          {tr("Acceptance does not appoint a captain or assign a team.")}
        </PageHeading>
        <div className="section-title">
          <p className="muted small">
            {tr(
              "{count, plural, one {# matching application} other {# matching applications}}",
              { count: total },
            )}
          </p>
          <div
            className="actions registration-review-actions"
            role="group"
            aria-label={tr("Registration actions")}
          >
            {editionSlug && editions.find((e) => e.slug === editionSlug) && (
              <ManualRegistration
                edition={editions.find((e) => e.slug === editionSlug)!}
              />
            )}
            {total > 0 && (
              <a
                className="button secondary"
                href={`/api/admin/registrations/export?${query}`}
              >
                {tr("Export CSV ↓")}
              </a>
            )}
          </div>
        </div>
        <form className="filters" action={basePath} method="get">
          <label className="field">
            <span>{tr("Search player or osu! ID")}</span>
            <input
              name="q"
              defaultValue={filters.q}
              maxLength={100}
              placeholder={tr("Username or stable osu! ID")}
            />
          </label>
          {!editionSlug && (
            <label className="field">
              <span>{tr("Edition")}</span>
              <select name="edition" defaultValue={filters.edition}>
                <option value="">{tr("All editions")}</option>
                {editions.map((e) => (
                  <option key={e.slug} value={e.slug}>
                    {e.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="field">
            <span>{tr("Status")}</span>
            <select name="status" defaultValue={filters.status}>
              <option value="active">{tr("Active registrations")}</option>
              <option value="">{tr("All statuses")}</option>
              {["pending", "accepted", "rejected", "withdrawn"].map(
                (status) => (
                  <option key={status} value={status}>
                    {tr(status)}
                  </option>
                ),
              )}
            </select>
          </label>
          <button type="submit">{tr("Filter")}</button>
        </form>
        {rows.length ? (
          <div
            className="table-scroll"
            role="region"
            tabIndex={0}
            aria-label={tr(
              "Registration table; scroll horizontally on small screens",
            )}
          >
            <table>
              <caption className="sr-only">
                {tr("Private registration review, page ")}
                {filters.page}
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
                      {tr(h)}
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
                        {tr(r.status)}
                      </span>
                    </td>
                    <td>{tr(formatDate(r.createdAt, "UTC", tr.locale))}</td>
                    <td>
                      <Link
                        className="button secondary"
                        href={`/admin/tournaments/${r.editionSlug}/registrations/${r.id}`}
                      >
                        {tr("Review")}
                        <span className="sr-only"> {r.username}</span>
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
              ? tr("No matching registrations.")
              : tr("No registrations yet.")}
          </p>
        )}
        <nav aria-label={tr("Application pages")} className="actions spaced">
          {filters.page > 1 && (
            <Link
              className="button secondary"
              href={`${basePath}?${query}&page=${filters.page - 1}`}
            >
              {tr("← Previous")}
            </Link>
          )}
          {filters.page * 25 < total && (
            <Link
              className="button secondary"
              href={`${basePath}?${query}&page=${filters.page + 1}`}
            >
              {tr("Next →")}
            </Link>
          )}
        </nav>
      </section>
    );
  });
}
