import { publicCompetition } from "@/lib/public-competition";
import { PublicMatches } from "@/components/public-matches";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { EmptyState, PageHeading } from "@/components/ui";
export const metadata = { title: "Tournament schedule" };
export default async function Schedule({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const competition = await publicCompetition(slug);
  const fixtures = [...(competition?.fixtures ?? [])].sort((a, b) =>
    (a.scheduledAt ?? "9999").localeCompare(b.scheduledAt ?? "9999"),
  );
  return (
    <>
      <PageHeading eyebrow={edition.name} title="Schedule">
        Match times use each fixture’s IANA time zone. Unconfirmed times remain
        TBA.
      </PageHeading>
      <PublicMatches fixtures={fixtures} slug={slug} />
      <section className="section-space">
        <h2>Tournament milestones</h2>
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
                    {formatDate(event.at, edition.timeZone)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="Schedule to be announced">
            Confirmed captain selection, draft and competition dates will appear
            here.
          </EmptyState>
        )}
      </section>
    </>
  );
}
