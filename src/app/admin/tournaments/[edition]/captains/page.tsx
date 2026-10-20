import { authorizedPage } from "@/lib/auth/page";
import { requireStaff } from "@/lib/auth/staff";
import { captainSetup } from "@/lib/captains";
import { PageHeading, EmptyState } from "@/components/ui";
import { CaptainManager } from "@/components/captain-manager";
export default async function Captains({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  return authorizedPage(async () => {
    const actor = await requireStaff();
    const { edition } = await params;
    const setup = await captainSetup(actor, edition);
    return (
      <>
        <PageHeading eyebrow={edition} title="Captains & player pool">
          Accepted individual applicants, staff appointments and a reviewed
          captain order.
        </PageHeading>
        <p className="notice">
          Setup {setup.locked ? "locked" : "unlocked"} · revision{" "}
          {setup.version}. Captain counts and roster sizes are set by approved
          event rules.
        </p>
        {setup.captains.length ? (
          <ol className="schedule-list">
            {setup.captains.map((c, index) => (
              <li key={c.userId}>
                <span className="eyebrow">{index + 1}</span>
                <div>
                  <h2>{c.username}</h2>
                  <p className="muted small">
                    osu! ID {c.userId} · {c.published ? "published" : "private"}{" "}
                    ·{c.teamName ?? "team not configured"}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <EmptyState title="No captains appointed">
            Appoint accepted, available individual players.
          </EmptyState>
        )}
        <h2 className="section-space">Eligible remaining pool</h2>
        <p className="muted">
          {setup.pool.length} eligible player(s). Captains and unavailable
          applicants are excluded.
        </p>
        <ul>
          {setup.pool.map((p) => (
            <li key={p.userId}>
              {p.username} <span className="muted">({p.userId})</span>
            </li>
          ))}
        </ul>
        <CaptainManager key={setup.version} slug={edition} setup={setup} />
      </>
    );
  });
}
