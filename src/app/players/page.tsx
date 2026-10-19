import { Action, PageHeading } from "@/components/ui";
export const metadata = { title: "Player center" };
export default function Players() {
  return (
    <div className="container page">
      <PageHeading
        eyebrow="INDIVIDUAL PLAYERS. ONE COMMUNITY."
        title="Your OCLR starts with you."
      >
        Sign in with osu! to apply individually and track your own tournament
        registrations.
      </PageHeading>
      <div className="actions">
        <Action href="/dashboard">Open player dashboard →</Action>
        <Action href="/tournaments" secondary>
          Browse tournaments
        </Action>
      </div>
      <p className="notice spaced">
        Applications are private. Public participants and finalized team rosters
        appear only after organizer approval and publication.
      </p>
    </div>
  );
}
