import { authorizedPage } from "@/lib/auth/page";
import Link from "next/link";
import { requireUser } from "@/lib/auth/user";
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
    const review = await matchReview(actor, edition, fixtureId);
    const data = review.context;
    return (
      <>
        <Link
          className="text-link"
          href={`/admin/tournaments/${edition}/matches`}
        >
          ← Fixtures
        </Link>
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
              : "Match time TBA"}{" "}
            · {data.fixture.timeZone}
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
