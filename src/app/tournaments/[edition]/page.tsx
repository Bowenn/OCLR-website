import { registrationAvailability } from "@/lib/registrations";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getPublicEdition } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { Action, Badge, PageHeading } from "@/components/ui";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition } = await params;
  return { title: (await getPublicEdition(edition))?.name ?? "Tournament" };
}
export default async function Overview({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const { edition: slug } = await params;
  const edition = await getPublicEdition(slug);
  if (!edition) notFound();
  const state = await registrationAvailability(edition);
  return (
    <>
      <PageHeading eyebrow="TOURNAMENT OVERVIEW" title={edition.name}>
        {edition.summary}
      </PageHeading>
      <section
        className="edition-overview"
        aria-label="Tournament registration overview"
      >
        {edition.branding.keyVisual && (
          <Image
            className="edition-key-visual"
            src={edition.branding.keyVisual}
            unoptimized
            alt={`${edition.name} key visual`}
            width={1672}
            height={941}
            sizes="(max-width: 760px) 100vw, 900px"
          />
        )}
        <div className="edition-enrollment">
          <div className="section-title">
            <h2>Registration</h2>
            <Badge>{state}</Badge>
          </div>
          <p className="muted small">
            Individual entry. Captain-led team draft.
          </p>
          <dl className="detail-list">
            <div>
              <dt>Tournament</dt>
              <dd>{edition.status}</dd>
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
            {state === "open" && (
              <Action href={`/tournaments/${slug}/register`}>
                Register individually →
              </Action>
            )}
            <Action href={`/tournaments/${slug}/rules`} secondary>
              Read the rules
            </Action>
            <Action href={`/tournaments/${slug}/schedule`} secondary>
              View schedule
            </Action>
          </div>
        </div>
      </section>
      {edition.eligibility && (
        <section className="section-space">
          <h2>Eligibility</h2>
          <p className="muted">{edition.eligibility}</p>
        </section>
      )}
    </>
  );
}
