import { requireStaff } from "@/lib/auth/staff";
import { captainSetup } from "@/lib/captains";
import { staffTeams } from "@/lib/teams";
import { PageHeading } from "@/components/ui";
import { TeamManager } from "@/components/team-manager";
import { ConfirmMutation } from "@/components/confirm-mutation";
export default async function Teams({
  params,
}: {
  params: Promise<{ edition: string }>;
}) {
  const actor = await requireStaff();
  const { edition } = await params;
  const setup = await captainSetup(actor, edition);
  const data = await staffTeams(actor, edition);
  return (
    <>
      <PageHeading eyebrow={edition} title="Team management">
        Staff-configured captain teams. Membership comes from the authoritative
        draft.
      </PageHeading>
      <div className="stack">
        {data.teams.map((t) => (
          <article className="panel" key={t.id}>
            <h2>{t.name}</h2>
            <p className="muted small">
              Captain osu! ID {t.captainId} · {t.members.length} member(s)
              {t.capacity ? ` / capacity ${t.capacity}` : ""} ·{" "}
              {t.finalizedAt ? "finalized" : "not finalized"}
            </p>
            <ul>
              {t.members.map((m) => (
                <li key={m.osuId}>
                  {m.username} ({m.osuId})
                </li>
              ))}
            </ul>
            <div className="actions">
              <ConfirmMutation
                label={
                  t.identityPublished
                    ? "Hide team identity"
                    : "Publish team identity"
                }
                title="Change public team visibility?"
                description="Only publish identities approved by the organizers. Rosters remain hidden until finalized and approved separately."
                url={`/api/admin/tournaments/${edition}/teams`}
                payload={{
                  command: {
                    action: "publish",
                    teamId: t.id,
                    identityPublished: !t.identityPublished,
                    rosterPublished: false,
                  },
                  expectedVersion: data.version,
                  reason: "Staff confirmed team identity publication change.",
                  confirmed: true,
                }}
              />
              {t.finalizedAt && t.identityPublished && (
                <ConfirmMutation
                  label={
                    t.rosterPublished
                      ? "Hide roster"
                      : "Publish finalized roster"
                  }
                  title="Change public roster visibility?"
                  description="This releases only the finalized players’ osu! IDs and display names. Verify organizer approval."
                  url={`/api/admin/tournaments/${edition}/teams`}
                  payload={{
                    command: {
                      action: "publish",
                      teamId: t.id,
                      identityPublished: true,
                      rosterPublished: !t.rosterPublished,
                    },
                    expectedVersion: data.version,
                    reason:
                      "Staff confirmed finalized roster publication change.",
                    confirmed: true,
                  }}
                />
              )}
            </div>
          </article>
        ))}
      </div>
      {!data.locked && setup.captains.length > 0 && (
        <TeamManager
          key={data.version}
          slug={edition}
          version={data.version}
          captains={setup.captains.map((c) => {
            const t = data.teams.find((t) => t.captainId === c.userId);
            return { ...c, name: t?.name ?? "", capacity: t?.capacity ?? null };
          })}
        />
      )}
    </>
  );
}
