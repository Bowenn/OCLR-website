import { historicalPage } from "@/components/historical-archive";
import { getAppTranslations } from "@/i18n/server";
import { publicBracket } from "@/lib/brackets";
import { formatDate } from "@/lib/editions";
import { EmptyState, PageHeading } from "@/components/ui";
import { BracketView } from "@/components/bracket-view";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Tournament bracket & results") };
}

export default async function Bracket({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition } = await params;
  const archivePage = await historicalPage(edition, "bracket");
  if (archivePage) return archivePage;
  const bracket = await publicBracket(edition);
  return (
    <>
      <PageHeading title={tr("Bracket & results")}>
        {bracket?.formatLabel}
      </PageHeading>
      {bracket ? (
        <>
          <p className="muted small">
            {tr("Updated ")}
            {tr(formatDate(bracket.updatedAt, "UTC", tr.locale))}{" "}
            {tr(" · Source:")}{" "}
            {bracket.source.url ? (
              <a
                className="context-link"
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
        <EmptyState title={tr("Bracket awaiting publication")}>
          {tr(
            "The format and results are not yet published, or finalized team rosters are awaiting approval.",
          )}
        </EmptyState>
      )}
    </>
  );
}
