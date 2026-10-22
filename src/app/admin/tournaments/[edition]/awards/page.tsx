import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { awardWorkspace } from "@/lib/awards";
import { PageHeading } from "@/components/ui";
import { AwardManager } from "@/components/award-manager";
export default async function Awards({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();
  return authorizedPage(async () => (
    <>
      <PageHeading title={tr("Weekly awards")} />
      <AwardManager
        initial={await awardWorkspace(
          await requireUser(),
          (await params).edition,
        )}
      />
    </>
  ));
}
