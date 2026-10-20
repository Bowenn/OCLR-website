import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { assertCapability } from "@/lib/auth/staff";
import { PageHeading } from "@/components/ui";
import { CreateTournamentForm } from "@/components/tournament-editor";
export const metadata = { title: "Create tournament" };
export default async function NewTournament() {
  return authorizedPage(async () => {
    await assertCapability(await requireUser(), "configure_tournament");
    return (
      <>
        <PageHeading eyebrow="TOURNAMENT MANAGEMENT" title="Create tournament">
          Start privately with approved identity information. Rules and
          registration are configured separately.
        </PageHeading>
        <CreateTournamentForm />
      </>
    );
  });
}
