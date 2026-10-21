import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
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
