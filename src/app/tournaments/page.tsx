import { getAppTranslations } from "@/i18n/server";
import { PageHeading } from "@/components/ui";
import { EditionCard } from "@/components/edition-card";
import { getPublicEditions } from "@/lib/content";
export const dynamic = "force-dynamic";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Tournaments") };
}

export default async function Tournaments() {
  const tr = await getAppTranslations();

  const editions = await getPublicEditions();
  return (
    <div className="container page">
      <PageHeading title={tr("Tournaments")} />
      {editions.length ? (
        <div className="stack">
          {editions.map((edition) => (
            <EditionCard edition={edition} key={edition.slug} />
          ))}
        </div>
      ) : (
        <p className="muted">{tr("No tournaments announced yet.")}</p>
      )}
    </div>
  );
}
