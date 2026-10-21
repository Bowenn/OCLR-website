import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { publicCompetition } from "@/lib/public-competition";
import { PageHeading } from "@/components/ui";
import { PublicMatches, GroupStandings } from "@/components/public-matches";
export const metadata = { title: "Competition results" };
export default async function Results({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const data = await publicCompetition(slug);
  return (
    <>
      <PageHeading eyebrow={edition.name} title="Results">
        Published scores, verified match sources and group standings. Referee
        submissions remain private until approval and publication.
      </PageHeading>
      <PublicMatches
        fixtures={data?.fixtures ?? []}
        slug={slug}
        groups={data?.groups ?? []}
      />
      <GroupStandings groups={data?.groups ?? []} slug={slug} />
    </>
  );
}
