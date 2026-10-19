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
  const edition = getPublicEdition(slug);
  if (!edition) notFound();
  return (
    <>
      <PageHeading eyebrow={edition.name} title="Schedule">
        All times are shown in {edition.timeZone}.
      </PageHeading>
      {edition.schedule.length ? (
        <ol className="schedule-list">
          {edition.schedule.map((event, i) => (
            <li key={i}>
              <span className="eyebrow">{String(i + 1).padStart(2, "0")}</span>
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
    </>
  );
}
