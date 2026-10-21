import { RulesHandbook } from "@/components/rules-handbook";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { Action, EmptyState, PageHeading } from "@/components/ui";
export const metadata = { title: "Tournament rules" };
export default async function Rules({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  return (
    <>
      <PageHeading eyebrow={edition.name} title="Rules">
        Published rules and organizer updates for this edition.
      </PageHeading>
      <p className="small muted">
        Accepted registrations automatically appear in this tournament’s public
        Players directory with their osu! username, osu! ID and participation
        status. Application answers and review notes stay private.
      </p>
      {edition.rules ? (
        <>
          <p className="rules-version muted small">
            Version {edition.rules.version} · {edition.rules.sections.length}{" "}
            sections
          </p>
          <RulesHandbook sections={edition.rules.sections} />
        </>
      ) : (
        <>
          <EmptyState title="Rules to be announced">
            Rules have not been published for this edition. Check the
            registration page for current availability.
          </EmptyState>
          <div className="actions spaced">
            <Action href={`/tournaments/${slug}/register`} secondary>
              View registration
            </Action>
          </div>
        </>
      )}
    </>
  );
}
