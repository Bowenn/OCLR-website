import { applicationAnswers } from "@/lib/application-answers";
import Link from "next/link";
import { RegistrationRemoval } from "@/components/registration-removal";
import { EligibilitySummary } from "@/components/eligibility-summary";
import { getAppTranslations } from "@/i18n/server";
import { notFound } from "next/navigation";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { applicationDetails } from "@/lib/staff";
import { readTournament } from "@/lib/tournaments";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
import { BwsReview } from "@/components/bws-review";
import { ReviewForm } from "@/components/review-form";
export default async function Application({
  params,
}: {
  params: Promise<{ id: string; edition: string }>;
}) {
  const tr = await getAppTranslations();

  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { id, edition: slug } = await params;
    const data = await applicationDetails(actor, id);
    if (data.registration.editionSlug !== slug) notFound();
    const { registration: r, username } = data;
    const record = await readTournament(r.editionSlug);
    const edition = record?.edition;
    return (
      <>
        <PageHeading eyebrow={edition?.name ?? r.editionSlug} title={username}>
          {tr("Private individual application · osu! ID ")}
          {r.userId}
        </PageHeading>
        <section className="panel">
          <span className={`badge status-${r.status}`}>{tr(r.status)}</span>
          {r.status === "withdrawn" &&
            data.lastOperation === "staff_remove" && (
              <p role="status" className="notice small">
                {tr("Registration removed by staff. Its history is retained.")}
              </p>
            )}
          {r.status === "pending" && data.lastOperation === "staff_restore" && (
            <p role="status" className="notice small">
              {tr(
                "Registration restored for review. No new player acknowledgments were recorded.",
              )}
            </p>
          )}
          <dl className="detail-list">
            <div>
              <dt>{tr("Submitted")}</dt>
              <dd>{tr(formatDate(r.createdAt, "UTC", tr.locale))}</dd>
            </div>
            <div>
              <dt>{tr("Registration source")}</dt>
              <dd>
                {r.source === "staff"
                  ? tr("Staff-assisted entry")
                  : tr("Player submission")}
              </dd>
            </div>
            <div>
              <dt>{tr("Rules acknowledged")}</dt>
              <dd>
                {r.rulesVersion ??
                  (r.source === "staff"
                    ? tr("Not acknowledged by the player")
                    : tr("No rules configured at submission"))}
              </dd>
            </div>
            {applicationAnswers(r.answers, data.acknowledgedConfiguration).map(
              ({ id, label, value }) => (
                <div key={id}>
                  <dt>{label}</dt>
                  <dd className="preserve-lines">{value || tr("No answer")}</dd>
                </div>
              ),
            )}
            {r.statusReason && (
              <div>
                <dt>{tr("Explanation")}</dt>
                <dd>{r.statusReason}</dd>
              </div>
            )}
          </dl>
        </section>
        {r.eligibilityVerification && (
          <EligibilitySummary
            value={r.eligibilityVerification}
            currentRevision={record?.revision}
          />
        )}
        {r.status !== "withdrawn" && <BwsReview slug={slug} id={r.id} />}
        {r.status === "pending" && (
          <ReviewForm id={r.id} updatedAt={r.updatedAt.toISOString()} />
        )}
        <RegistrationRemoval
          id={r.id}
          slug={slug}
          tournament={edition?.name ?? slug}
          username={username}
          osuId={r.userId}
          status={r.status}
          updatedAt={r.updatedAt.toISOString()}
          staffRemoved={data.lastOperation === "staff_remove"}
        />
        <Link
          className="context-link spaced"
          href={`/admin/tournaments/${slug}/registrations`}
        >
          {tr("View registrations")}
        </Link>
      </>
    );
  });
}
