import { PageHeading } from "@/components/ui";
import { EditionCard } from "@/components/edition-card";
import { getPublicEditions } from "@/lib/content";
export const dynamic = "force-dynamic";
export const metadata = { title: "Tournaments" };
export default async function Tournaments() {
  const editions = await getPublicEditions();
  return (
    <div className="container page">
      <PageHeading title="Tournaments" />
      {editions.length ? (
        <div className="stack">
          {editions.map((edition) => (
            <EditionCard edition={edition} key={edition.slug} />
          ))}
        </div>
      ) : (
        <p className="muted">No tournaments announced yet.</p>
      )}
    </div>
  );
}
