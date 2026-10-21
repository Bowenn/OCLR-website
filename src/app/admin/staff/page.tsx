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
        <PageHeading eyebrow="ACCESS CONTROL" title="Staff assignments" />
        <StaffRoleForm
          key={selected?.slug ?? "all"}
          initialEdition={selected?.slug ?? ""}
          editions={editions
            .filter((e) => !scopes || scopes.includes(e.slug))
            .map((e) => ({ slug: e.slug, name: e.name }))}
          scopes={scopes}
        />
        <section className="spaced">
          <h2>Role assignments</h2>
          {!grants.length && (
            <EmptyState title="No persistent assignments">
              Bootstrap administrators are configured on the server and do not
              appear here.
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
                  {g.role} · {g.editionSlug ?? "Global"} ·{" "}
                  {g.revokedAt ? "Revoked" : "Active"}
                </p>
                <p className="small muted">
                  About:{" "}
                  {g.aboutPublished && !g.revokedAt
                    ? !g.editionSlug ||
                      editions.some(
                        (e) => e.slug === g.editionSlug && e.published,
                      )
                      ? "Public"
                      : "Hidden until tournament publication"
                    : "Private"}
                </p>
                <p className="muted small">
                  Granted by osu! ID {g.grantedBy} on{" "}
                  {g.grantedAt.toISOString()}
                </p>
                {!g.revokedAt && (
                  <div className="actions">
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
