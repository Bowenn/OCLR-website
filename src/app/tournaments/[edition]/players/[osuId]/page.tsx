import { notFound } from "next/navigation";
import { historicalPage } from "@/components/historical-archive";
export default async function HistoricalPlayer({
  params,
}: {
  params: Promise<{ edition: string; osuId: string }>;
}) {
  const { edition, osuId } = await params;
  const page = await historicalPage(edition, "player", osuId);
  if (!page) notFound();
  return page;
}
