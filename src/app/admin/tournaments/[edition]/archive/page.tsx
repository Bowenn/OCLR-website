import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { tournamentForAdmin } from "@/lib/tournaments";
import { getAppTranslations } from "@/i18n/server";
import { PageHeading } from "@/components/ui";
import { ArchiveImporter } from "@/components/archive-importer";
export default async function Archive({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const tr = await getAppTranslations();
    const data = await tournamentForAdmin(
      await requireStaff(),
      (await params).edition,
    );
    return (
      <>
        <PageHeading title={tr("Historical archive")} />
        <ArchiveImporter
          slug={data.edition.slug}
          revision={data.revision}
          published={data.edition.published}
          eligible={
            data.edition.status === "completed" && !data.edition.registration
          }
          archive={data.edition.archive}
        />
      </>
    );
  });
}
