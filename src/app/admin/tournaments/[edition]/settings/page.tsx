import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { tournamentForAdmin } from "@/lib/tournaments";
import { PageHeading } from "@/components/ui";
import { TournamentEditor } from "@/components/tournament-editor";
export const metadata = { title: "Tournament settings" };
export default async function Settings({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const { edition } = await params;
    const data = await tournamentForAdmin(await requireStaff(), edition);
    return (
      <>
        <PageHeading
          eyebrow="TOURNAMENT CONFIGURATION"
          title="Tournament settings"
        >
          Each section saves independently.
        </PageHeading>
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
