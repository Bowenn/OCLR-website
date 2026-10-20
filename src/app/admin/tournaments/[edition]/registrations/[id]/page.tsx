import { notFound } from "next/navigation";
import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { applicationDetails } from "@/lib/staff";
import { getEdition } from "@/lib/content";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
import { ReviewForm } from "@/components/review-form";
export default async function Application({
  params,
}: {
  params: Promise<{ id: string; edition: string }>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { id, edition: slug } = await params;
    const data = await applicationDetails(actor, id);
    if (data.registration.editionSlug !== slug) notFound();
    const { registration: r, username, events } = data;
    const edition = await getEdition(r.editionSlug);
    return (
      <>
        <PageHeading eyebrow={edition?.name ?? r.editionSlug} title={username}>
          Private individual application · osu! ID {r.userId}
        </PageHeading>
        <section className="panel">
          <span className={`badge status-${r.status}`}>{r.status}</span>
          <dl className="detail-list">
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(r.createdAt, "UTC")}</dd>
            </div>
            <div>
              <dt>Rules acknowledged</dt>
              <dd>{r.rulesVersion ?? "No rules configured at submission"}</dd>
            </div>
            {Object.entries(r.answers).map(([key, value]) => (
              <div key={key}>
                <dt>
                  {data.acknowledgedConfiguration?.registration?.questions.find(
                    (q) => q.id === key,
                  )?.label ?? key}
                </dt>
                <dd className="preserve-lines">{value || "No answer"}</dd>
              </div>
            ))}
            {r.statusReason && (
              <div>
                <dt>Explanation</dt>
                <dd>{r.statusReason}</dd>
              </div>
            )}
          </dl>
        </section>
        {r.status === "pending" && (
          <ReviewForm id={r.id} updatedAt={r.updatedAt.toISOString()} />
        )}
        <section className="section-space">
          <h2>Audit trail</h2>
          <ol className="schedule-list">
            {events.map((e) => (
              <li key={e.id}>
                <div>
                  <h3>
                    {e.fromStatus ?? "new"} → {e.toStatus}
                  </h3>
                  <p className="muted small">
                    Actor osu! ID {e.actorId ?? "removed"} ·{" "}
                    {formatDate(e.createdAt, "UTC")}
                  </p>
                  {e.reason && (
                    <p className="preserve-lines small">{e.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      </>
    );
  });
}
