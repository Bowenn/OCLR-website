import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { mappoolWorkspace } from "@/lib/mappools";
import { PageHeading } from "@/components/ui";
import { MappoolEditor } from "@/components/mappool-editor";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Manage mappools") };
}

export default async function MappoolsPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const actor = await requireUser();
    const { edition } = await params;
    const data = await mappoolWorkspace(actor, edition);
    return (
      <>
        <PageHeading
          eyebrow={tr("COMPETITION MAPS")}
          title={tr("Mappool management")}
        />
        <MappoolEditor slug={edition} data={data} />
      </>
    );
  });
}
