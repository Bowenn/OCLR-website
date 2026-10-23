import { getAppTranslations } from "@/i18n/server";
import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { staffFixtures } from "@/lib/fixtures";
import { fixtureSlot } from "@/lib/fixture-views";
import { HttpError } from "@/lib/http";
import { matchReview } from "@/lib/results";
import { MatchSourceCompletion } from "@/components/match-source-completion";
import { MatchReviewPanel } from "@/components/match-review";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Fixture review") };
}

export default async function FixturePage({
  params,
}: {
  params: Promise<{ edition: string; fixtureId: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const actor = await requireUser();
    const { edition, fixtureId } = await params;
    const review = await matchReview(actor, edition, fixtureId).catch(
      async (error: unknown) => {
        if (!(error instanceof HttpError) || error.status !== 409) throw error;
        const workspace = await staffFixtures(actor, edition);
        const fixture = workspace.fixtures.find((f) => f.id === fixtureId);
        if (
          !fixture ||
          (workspace.teams.some((t) => t.id === fixture.homeTeamId) &&
            workspace.teams.some((t) => t.id === fixture.awayTeamId))
        )
          throw error;
        return { planned: { fixture, workspace } };
      },
    );
    if ("planned" in review) {
      const { fixture, workspace } = review.planned;
      return (
        <>
          <PageHeading eyebrow={tr("PLANNED MATCH")} title={fixture.label}>
            {fixtureSlot(workspace, fixture, "home").label} {tr(" vs")}{" "}
            {fixtureSlot(workspace, fixture, "away").label}
          </PageHeading>
          <div className="panel form-stack planned-match-panel">
            <p>
              {fixture.scheduledAt
                ? tr(
                    formatDate(
                      fixture.scheduledAt,
                      fixture.timeZone,
                      tr.locale,
                    ),
                  )
                : tr("Match time TBA")}
            </p>
            <p>
              {tr("Assigned referees:")}{" "}
              {fixture.referees.map((r) => r.username).join(", ") || tr("None")}
            </p>
            <MatchSourceCompletion
              slug={edition}
              fixtureId={fixture.id}
              canManage={workspace.canManage}
            />
          </div>
        </>
      );
    }
    const data = review.context;
    return (
      <>
        <PageHeading
          eyebrow={tr("{value0} STAGE / {value1}", {
            value0: data.round.stage === "group" ? "GROUP" : "KNOCKOUT",
            value1: data.round.name,
          })}
          title={data.fixture.label}
        >
          {data.teams.map((t) => t.name).join(" vs ")} ·{" "}
          {tr(data.fixture.status)}
        </PageHeading>
        <div className="panel">
          <p>
            {data.fixture.scheduledAt
              ? tr(
                  formatDate(
                    data.fixture.scheduledAt,
                    data.fixture.timeZone,
                    tr.locale,
                  ),
                )
              : tr("Match time TBA ({value0})", {
                  value0: data.fixture.timeZone,
                })}
          </p>
          <p>
            {data.pool
              ? tr("Associated pool: {value0}", { value0: data.pool.name })
              : tr("No mappool associated")}
          </p>
        </div>
        <MatchReviewPanel data={review} slug={edition} />
      </>
    );
  });
}
