import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { staffFixtures } from "@/lib/fixtures";
import { PageHeading } from "@/components/ui";
import { FixtureManager } from "@/components/fixture-manager";
export const metadata = { title: "Competition fixtures" };
export default async function FixturesPage({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const actor = await requireUser();
    const { edition } = await params;
    return (
      <>
        <PageHeading eyebrow="COMPETITION OPERATIONS" title="Match fixtures">
          Schedule official teams and assign referees. A scheduled fixture and
          an approved result are separate records.
        </PageHeading>
        <FixtureManager
          slug={edition}
          data={await staffFixtures(actor, edition)}
        />
      </>
    );
  });
}
