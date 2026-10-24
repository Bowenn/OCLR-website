import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { assertReadCapability } from "@/lib/auth/staff";
import { PageHeading } from "@/components/ui";
import { CreateTournamentForm } from "@/components/tournament-editor";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Create tournament") };
}

export default async function NewTournament() {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    await assertReadCapability(await requireUser(), "configure_tournament");
    return (
      <>
        <PageHeading
          eyebrow={tr("TOURNAMENT MANAGEMENT")}
          title={tr("Create tournament")}
        >
          {tr("Start with a name. Add details when you’re ready.")}
        </PageHeading>
        <CreateTournamentForm />
      </>
    );
  });
}
