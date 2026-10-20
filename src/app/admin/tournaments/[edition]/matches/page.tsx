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
    const data = await staffFixtures(actor, edition);
    return (
      <>
        <PageHeading
          eyebrow="COMPETITION"
          title={data.canManage ? "Fixtures & results" : "My assigned matches"}
        />
        <FixtureManager slug={edition} data={data} />
      </>
    );
  });
}
