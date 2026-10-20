import { authorizedPage } from "@/lib/auth/page";
import { requireUser } from "@/lib/auth/user";
import { staffFixtures } from "@/lib/fixtures";
import { fixtureSlot } from "@/lib/fixture-views";
import { HttpError } from "@/lib/http";
import { matchReview } from "@/lib/results";
import { MatchReviewPanel } from "@/components/match-review";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
export const metadata = { title: "Fixture review" };
export default async function FixturePage({
  params,
}: {
  params: Promise<{ edition: string; fixtureId: string }>;
}) {
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
          <PageHeading eyebrow="PLANNED MATCH" title={fixture.label}>
            {fixtureSlot(workspace, fixture, "home").label} vs{" "}
            {fixtureSlot(workspace, fixture, "away").label}
          </PageHeading>
          <div className="panel form-stack">
            <p>
              {fixture.scheduledAt
                ? formatDate(fixture.scheduledAt, fixture.timeZone)
                : "Match time TBA"}
            </p>
            <p>
              Assigned referees:{" "}
              {fixture.referees.map((r) => r.username).join(", ") || "None"}
            </p>
            <p className="notice">
              Participants are not confirmed. An Admin must select two
              finalized, published teams before importing or reviewing results.
            </p>
          </div>
        </>
      );
    }
    const data = review.context;
    return (
      <>
        <PageHeading
          eyebrow={`${data.round.stage === "group" ? "GROUP" : "KNOCKOUT"} STAGE / ${data.round.name}`}
          title={data.fixture.label}
        >
          {data.teams.map((t) => t.name).join(" vs ")} ·{" "}
          {data.fixture.status.replaceAll("_", " ")}
        </PageHeading>
        <div className="panel">
          <p>
            {data.fixture.scheduledAt
              ? formatDate(data.fixture.scheduledAt, data.fixture.timeZone)
              : `Match time TBA (${data.fixture.timeZone})`}
          </p>
          <p>
            {data.pool
              ? `Associated pool: ${data.pool.name}`
              : "No mappool associated"}
          </p>
        </div>
        <MatchReviewPanel data={review} slug={edition} />
      </>
    );
  });
}
