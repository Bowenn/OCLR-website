import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { publicCompetition } from "@/lib/public-competition";
import { PageHeading } from "@/components/ui";
import { PublicMatches, GroupStandings } from "@/components/public-matches";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Competition results") };
}

export default async function Results({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const data = await publicCompetition(slug);
  return (
    <>
      <PageHeading title={tr("Results")} />
      <PublicMatches
        fixtures={data?.fixtures ?? []}
        slug={slug}
        groups={data?.groups ?? []}
      />
      <GroupStandings groups={data?.groups ?? []} slug={slug} />
    </>
  );
}
