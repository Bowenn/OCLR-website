import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { listStaffRoles } from "@/lib/staff-roles";
import { getEditions } from "@/lib/content";
import { PageHeading, EmptyState } from "@/components/ui";
import {
  StaffRoleForm,
  RevokeRole,
  StaffPublicVisibility,
} from "@/components/staff-role-form";
export default async function StaffPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const { grants, scopes } = await listStaffRoles(await requireUser());
    const requested = (await searchParams).edition ?? "";
    const editions = await getEditions();
    const selected = editions.find(
      (e) => e.slug === requested && (!scopes || scopes.includes(e.slug)),
    );
    if (requested && !selected) notFound();
    return (
      <>
        <PageHeading
          eyebrow={tr("ACCESS CONTROL")}
          title={tr("Staff assignments")}
        />
        <StaffRoleForm
          key={selected?.slug ?? "all"}
          initialEdition={selected?.slug ?? ""}
          editions={editions
            .filter((e) => !scopes || scopes.includes(e.slug))
            .map((e) => ({ slug: e.slug, name: e.name }))}
          scopes={scopes}
        />
        <section className="spaced">
          <h2>{tr("Role assignments")}</h2>
          {!grants.length && (
            <EmptyState title={tr("No persistent assignments")}>
              {tr(
                "Bootstrap administrators are configured on the server and do not appear here.",
              )}
            </EmptyState>
          )}
          {grants
            .filter(
              ({ grant }) =>
                !selected ||
                grant.editionSlug === null ||
                grant.editionSlug === selected.slug,
            )
            .map(({ grant: g, username }) => (
              <article className="panel spaced" key={g.id}>
                <h3>
                  {username} · {g.userId}
                </h3>
                <p>
                  {g.role} · {g.editionSlug ?? tr("Global")} ·{" "}
                  {g.revokedAt ? tr("Revoked") : tr("Active")}
                </p>
                <p className="small muted">
                  {tr("About:")}{" "}
                  {g.aboutPublished && !g.revokedAt
                    ? !g.editionSlug ||
                      editions.some(
                        (e) => e.slug === g.editionSlug && e.published,
                      )
                      ? tr("Public")
                      : tr("Hidden until tournament publication")
                    : tr("Private")}
                </p>
                <p className="muted small">
                  {tr("Granted by osu! ID ")}
                  {g.grantedBy} {tr(" on")} {g.grantedAt.toISOString()}
                </p>
                {!g.revokedAt && (
                  <div className="staff-role-actions">
                    <StaffPublicVisibility
                      id={g.id}
                      username={username}
                      role={g.role}
                      scope={g.editionSlug}
                      published={g.aboutPublished}
                    />
                    <RevokeRole
                      id={g.id}
                      username={username}
                      role={g.role}
                      scope={g.editionSlug}
                    />
                  </div>
                )}
              </article>
            ))}
        </section>
      </>
    );
  });
}
