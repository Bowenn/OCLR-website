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
        <article className="prose">
          <p className="eyebrow">Version {edition.rules.version}</p>
          {edition.rules.sections.map((s, i) => (
            <section key={i}>
              <h2>{s.heading}</h2>
              <p className="preserve-lines">{s.body}</p>
            </section>
          ))}
        </article>
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
