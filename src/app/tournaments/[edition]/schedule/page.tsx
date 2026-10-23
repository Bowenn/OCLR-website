import { historicalPage } from "@/components/historical-archive";
import { getAppTranslations } from "@/i18n/server";
import { publicCompetition } from "@/lib/public-competition";
import { PublicMatches } from "@/components/public-matches";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { EmptyState, PageHeading } from "@/components/ui";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Tournament schedule") };
}

export default async function Schedule({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const tr = await getAppTranslations();

  const { edition: slug } = await params;
  const archivePage = await historicalPage(slug, "schedule");
  if (archivePage) return archivePage;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const competition = await publicCompetition(slug);
  const fixtures = [...(competition?.fixtures ?? [])].sort((a, b) =>
    (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999"),
  );
  return (
    <>
      <PageHeading title={tr("Schedule")}>
        {tr(
          "Match times use each fixture’s IANA time zone. Unconfirmed times remain TBA.",
        )}
      </PageHeading>
      <PublicMatches
        fixtures={fixtures}
        slug={slug}
        groups={competition?.groups ?? []}
      />
      <section className="section-space">
        <h2>{tr("Tournament milestones")}</h2>
        {edition.schedule.length ? (
          <ol className="schedule-list">
            {edition.schedule.map((event, i) => (
              <li key={i}>
                <span className="eyebrow">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h2>{event.label}</h2>
                  <p className="muted">
                    {tr(formatDate(event.at, edition.timeZone, tr.locale))}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title={tr("Schedule to be announced")}>
            {tr(
              "Confirmed captain selection, draft and competition dates will appear here.",
            )}
          </EmptyState>
        )}
      </section>
    </>
  );
}
