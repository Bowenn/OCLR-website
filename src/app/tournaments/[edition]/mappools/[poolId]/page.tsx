import { historicalPage } from "@/components/historical-archive";
import { getAppTranslations } from "@/i18n/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { publicMappools } from "@/lib/mappools";
import { PageHeading } from "@/components/ui";
import { MappoolBrowser } from "@/components/mappool-browser";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Mappool") };
}

export default async function PoolPage({
  params,
}: {
  params: Promise<{ edition: string; poolId: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition, poolId } = await params;
  const archivePage = await historicalPage(edition, "pool", poolId);
  if (archivePage) return archivePage;
  const [pool] = await publicMappools(edition, poolId);
  if (!pool) notFound();
  return (
    <>
      <Link className="context-link" href={`/tournaments/${edition}/mappools`}>
        {tr("← All mappools")}
      </Link>
      <PageHeading
        eyebrow={`${tr(pool.stage === "group" ? "Group Stage" : "Knockout Stage")} / ${pool.roundName}`}
        title={pool.name}
      >
        {tr("Published · Last updated ")}
        {pool.updatedAt.toISOString()}
      </PageHeading>
      <MappoolBrowser slug={edition} pool={pool} />
    </>
  );
}
