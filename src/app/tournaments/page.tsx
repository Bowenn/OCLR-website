import { EmptyState, PageHeading } from "@/components/ui";
import { EditionCard } from "@/components/edition-card";
import { getPublicEditions } from "@/lib/content";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tournaments" };
export default async function Tournaments() {
  const editions = await getPublicEditions();
  return (
    <div className="container page">
      <PageHeading eyebrow="THE OCLR STAGE" title="Tournament editions">
        Your starting point for rules, dates and individual registration.
      </PageHeading>
      {editions.length ? (
        <div className="stack">
          {editions.map((edition) => (
            <EditionCard edition={edition} key={edition.slug} />
          ))}
        </div>
      ) : (
        <EmptyState title="The next stage is on its way.">
          No tournament edition has been announced yet. Rules, dates and
          registration information will appear here when confirmed.
        </EmptyState>
      )}
    </div>
  );
}
