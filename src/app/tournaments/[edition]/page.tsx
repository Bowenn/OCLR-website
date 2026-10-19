import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { enrollmentState, formatDate } from "@/lib/editions";
import { Action, Badge, PageHeading } from "@/components/ui";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  return { title: getPublicEdition(edition)?.name ?? "Tournament" };
}
export default async function Overview({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const edition = getPublicEdition(slug);
  if (!edition) notFound();
  return (
    <>
      <PageHeading eyebrow="TOURNAMENT OVERVIEW" title={edition.name}>
        {edition.summary}
      </PageHeading>
      <div className="panel">
        <Badge>{edition.status}</Badge>
        <h2 className="spaced">Individual entry. Team competition.</h2>
        <p className="muted">
          Apply individually → staff appoint captains → eligible player pool →
          live captain-turn draft → published team rosters → team competition.
        </p>
        <dl className="detail-list">
          <div>
            <dt>Registration</dt>
            <dd>{enrollmentState(edition)}</dd>
          </div>
          <div>
            <dt>Opens</dt>
            <dd>
              {formatDate(
                edition.registration?.opensAt ?? null,
                edition.timeZone,
              )}
            </dd>
          </div>
          <div>
            <dt>Closes</dt>
            <dd>
              {formatDate(
                edition.registration?.closesAt ?? null,
                edition.timeZone,
              )}
            </dd>
          </div>
        </dl>
        <div className="actions">
          <Action href={`/tournaments/${slug}/rules`} secondary>
            Read the rules
          </Action>
          <Action href={`/tournaments/${slug}/schedule`} secondary>
            View schedule
          </Action>
        </div>
      </div>
      <section className="section-space">
        <h2>Eligibility</h2>
        <p className="muted">
          {edition.eligibility ??
            "Eligibility requirements are not yet published. Registration will remain unavailable until the rules are confirmed."}
        </p>
      </section>
    </>
  );
}
