import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { tournamentForAdmin } from "@/lib/tournaments";
import { PageHeading } from "@/components/ui";
import { TournamentEditor } from "@/components/tournament-editor";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Tournament settings") };
}

export default async function Settings({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const { edition } = await params;
    const data = await tournamentForAdmin(await requireStaff(), edition);
    return (
      <>
        <PageHeading
          eyebrow={tr("TOURNAMENT CONFIGURATION")}
          title={tr("Tournament settings")}
        />
        <TournamentEditor
          data={{
            edition: data.edition,
            revision: data.revision,
            applications: data.applications,
            frozen: data.frozen,
            readiness: data.readiness,
          }}
        />
      </>
    );
  });
}
