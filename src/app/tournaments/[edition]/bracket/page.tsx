import { publicBracket } from "@/lib/brackets";
import { formatDate } from "@/lib/editions";
import { EmptyState, PageHeading } from "@/components/ui";
import { BracketView } from "@/components/bracket-view";
export const metadata = { title: "Tournament bracket & results" };
export default async function Bracket({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  const bracket = await publicBracket(edition);
  return (
    <>
      <PageHeading eyebrow="THE COMPETITION" title="Bracket & results">
        {bracket
          ? bracket.formatLabel
          : "Confirmed match data will appear after final rosters and competition format are published."}
      </PageHeading>
      {bracket ? (
        <>
          <p className="muted small">
            Updated {formatDate(bracket.updatedAt, "UTC")} · Source:{" "}
            {bracket.source.url ? (
              <a
                className="text-link"
                href={bracket.source.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {bracket.source.label} ↗
              </a>
            ) : (
              bracket.source.label
            )}
          </p>
          <BracketView bracket={bracket} />
        </>
      ) : (
        <EmptyState title="Bracket awaiting publication">
          The format and results are not yet published, or finalized team
          rosters are awaiting approval.
        </EmptyState>
      )}
    </>
  );
}
