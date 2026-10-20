import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { tournamentForAdmin } from "@/lib/tournaments";
import { formatDate } from "@/lib/editions";
import { PageHeading } from "@/components/ui";
import { TournamentEditor } from "@/components/tournament-editor";
export const metadata = { title: "Tournament settings" };
export default async function Settings({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const { edition } = await params;
    const data = await tournamentForAdmin(await requireStaff(), edition);
    return (
      <>
        <PageHeading
          eyebrow="TOURNAMENT CONFIGURATION"
          title="Tournament settings"
        >
          Revision {data.revision}. Each section saves independently.
        </PageHeading>
        <TournamentEditor
          data={{
            edition: data.edition,
            revision: data.revision,
            applications: data.applications,
            frozen: data.frozen,
          }}
        />
        <details className="panel section-space">
          <summary>Recent tournament configuration history</summary>
          <ol className="schedule-list">
            {data.events.map((event) => (
              <li key={event.id}>
                <div>
                  <h3>
                    {event.kind.replace("tournament_", "").replaceAll("_", " ")}
                  </h3>
                  <p className="muted small">
                    osu! ID {event.actorId ?? "system migration"} ·{" "}
                    {formatDate(event.createdAt, "UTC")}
                  </p>
                  <details>
                    <summary>Recorded changes</summary>
                    <pre className="audit-json">
                      {JSON.stringify(event.detail, null, 2)}
                    </pre>
                  </details>
                </div>
              </li>
            ))}
          </ol>
        </details>
      </>
    );
  });
}
