import { RefereePanel } from "@/components/referee-panel";
import { PageHeading } from "@/components/ui";
import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { remotePage } from "@/lib/remote-page";
import { refereeWorkspace } from "@/lib/referee";

export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Referee panel") };
}
async function RefereePage({
  params,
}: {
  params: Promise<{ edition: string; fixtureId: string }>;
}) {
  const tr = await getAppTranslations();
  return authorizedPage(async () => {
    const { edition, fixtureId } = await params;
    const data = await refereeWorkspace(
      await requireUser(),
      edition,
      fixtureId,
    );
    return (
      <>
        <PageHeading
          eyebrow={tr("REFEREE WORKSPACE")}
          title={data.fixture.label}
        >
          {data.round.name} · {data.teams.map((t) => t.name).join(" vs ")}
        </PageHeading>
        <RefereePanel data={data} slug={edition} />
      </>
    );
  });
}

export default function Page(props: Parameters<typeof RefereePage>[0]) {
  return remotePage(() => RefereePage(props));
}
