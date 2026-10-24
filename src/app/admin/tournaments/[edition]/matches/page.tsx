import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { staffAccess, canRead } from "@/lib/auth/staff";
import { canViewStreaming, streamingWorkspace } from "@/lib/streaming";
import { StreamingManager } from "@/components/streaming-manager";
import { staffFixtures } from "@/lib/fixtures";
import { PageHeading } from "@/components/ui";
import { FixtureManager } from "@/components/fixture-manager";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Competition fixtures") };
}

export default async function FixturesPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const actor = await requireUser();
    const { edition } = await params;
    const access = await staffAccess(actor);
    if (
      canViewStreaming(access, edition) &&
      !canRead(access, "manage_fixtures", edition) &&
      !canRead(access, "record_results", edition)
    ) {
      const data = await streamingWorkspace(actor, edition);
      return (
        <>
          <PageHeading
            eyebrow={tr("COMPETITION")}
            title={tr("Streaming tasks")}
          />
          <StreamingManager slug={edition} data={data} />
        </>
      );
    }
    const data = await staffFixtures(actor, edition);
    return (
      <>
        <PageHeading
          eyebrow={tr("COMPETITION")}
          title={
            data.canManage
              ? tr("Fixtures & results")
              : tr("My assigned matches")
          }
        />
        <FixtureManager slug={edition} data={data} />
      </>
    );
  });
}
