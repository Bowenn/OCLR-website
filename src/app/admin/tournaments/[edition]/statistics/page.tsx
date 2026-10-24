import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { statisticsWorkspace } from "@/lib/archive-statistics";
import { StatisticsManager } from "@/components/statistics-manager";
import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
export default async function Page({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const tr = await getAppTranslations();
    const data = await statisticsWorkspace(
      await requireStaff(),
      (await params).edition,
    );
    return (
      <>
        <PageHeading title={tr("Historical statistics")} />
        <StatisticsManager initial={data} />
      </>
    );
  });
}
