import { historicalPage } from "@/components/historical-archive";
import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { publicDraft } from "@/lib/draft";
import { PageHeading } from "@/components/ui";
import { LiveDraft } from "@/components/live-draft";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Live draft") };
}

export default async function Draft({
  params,
  searchParams,
}: {
  params: Promise<{ edition: string }>;
  searchParams: Promise<{ presenter?: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition } = await params;
  const archivePage = await historicalPage(edition, "draft");
  if (archivePage) return archivePage;
  const presenter = (await searchParams).presenter === "1";
  return (
    <>
      {!presenter && (
        <>
          <PageHeading
            eyebrow={tr("THE TEAM STORY STARTS HERE")}
            title={tr("Captain draft")}
          >
            {tr("Published selections, captain turns and roster progress.")}
          </PageHeading>
          <Link
            href={`/tournaments/${edition}/draft?presenter=1`}
            className="text-link"
          >
            {tr("Open presenter view")}
          </Link>
          <Link
            href={`/tournaments/${edition}/draft/overlay`}
            className="text-link broadcast-link"
          >
            {tr("Open broadcast overlay")}
          </Link>
        </>
      )}
      <LiveDraft
        slug={edition}
        initial={await publicDraft(edition)}
        presenter={presenter}
      />
    </>
  );
}
