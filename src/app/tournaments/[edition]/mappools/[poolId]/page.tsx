import Link from "next/link";
import { notFound } from "next/navigation";
import { publicMappools } from "@/lib/mappools";
import { PageHeading } from "@/components/ui";
import { MappoolBrowser } from "@/components/mappool-browser";
export const metadata = { title: "Mappool" };
export default async function PoolPage({
  params,
}: {
  params: Promise<{ edition: string; poolId: string }>;
}) {
  const { edition, poolId } = await params;
  const [pool] = await publicMappools(edition, poolId);
  if (!pool) notFound();
  return (
    <>
      <Link className="text-link" href={`/tournaments/${edition}/mappools`}>
        ← All mappools
      </Link>
      <PageHeading
        eyebrow={`${pool.stage === "group" ? "GROUP" : "KNOCKOUT"} STAGE / ${pool.roundName}`}
        title={pool.name}
      >
        Published · Last updated {pool.updatedAt.toISOString()}
      </PageHeading>
      <MappoolBrowser slug={edition} pool={pool} />
    </>
  );
}
