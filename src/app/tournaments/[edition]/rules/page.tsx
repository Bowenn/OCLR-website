import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { EmptyState, PageHeading } from "@/components/ui";
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
        Read the confirmed rules before applying.
      </PageHeading>
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
        <EmptyState title="Rules to be announced">
          Registration remains unavailable until the rules are published.
        </EmptyState>
      )}
    </>
  );
}
