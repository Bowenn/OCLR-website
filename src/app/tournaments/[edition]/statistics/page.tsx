import { notFound } from "next/navigation";
import { publicArchiveStatistics } from "@/lib/archive-statistics";
import { HttpError } from "@/lib/http";
import { StatisticsExplorer } from "@/components/statistics-explorer";
import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
export default async function Page({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();
  let data;
  try {
    data = await publicArchiveStatistics((await params).edition);
  } catch (error) {
    if (error instanceof HttpError && error.status === 404) notFound();
    throw error;
  }
  return (
    <>
      <PageHeading
        eyebrow={tr("Historical archive")}
        title={tr("Player statistics")}
      />
      <StatisticsExplorer data={data} />
    </>
  );
}
