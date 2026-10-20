import { PageHeading } from "@/components/ui";
import { privacyContact, privacyReady } from "@/lib/auth/config";
export const metadata = { title: "Privacy" };
export default function Privacy() {
  const contact = privacyContact();
  return (
    <div className="container page prose">
      <PageHeading eyebrow="YOUR DATA" title="Privacy at OCLR">
        osu! Chinese League Rookie
      </PageHeading>
      <h2>What we collect</h2>
      <p>
        Signing in stores your stable osu! user ID, current display name and a
        secure session record. We do not receive your osu! password. OAuth
        access and refresh tokens are not retained.
      </p>
      <h2>Tournament applications</h2>
      <p>
        Applications contain your osu! identity, answers to the edition’s
        approved questions, rules acknowledgment, status and timestamps. Staff
        with registration permissions can review them. Applications are private;
        acceptance does not automatically publish your identity or assign you to
        a team.
      </p>
      <h2>Published competition information</h2>
      <p>
        Approved participant identities, captain status and finalized team
        rosters become public only after explicit publication. Released mappools
        and approved published match results, team scores and multiplayer source
        links can be read without signing in.
      </p>
      <h2>Competition records and staff actions</h2>
      <p>
        Published participant profiles can display dated public osu! metadata
        and ruleset statistics. A compact server-side snapshot is cached for 30
        minutes, with a maximum of 1,000 ID/ruleset combinations. Temporary
        provider failures retain the last successful snapshot with a stale
        label. Staff with registration permissions can look up public osu!
        profiles; lookup does not publish an application or determine
        eligibility.
      </p>
      <p>
        Assigned referees and administrators can review multiplayer snapshots
        containing player IDs and game scores. Unreviewed imports, internal
        review reasons and individual score evidence stay in the protected staff
        workspace. Staff-role changes and competition actions retain actor IDs,
        reasons, timestamps and revision history for accountability. Public
        match pages contain approved team totals and public result notes.
      </p>
      <h2>Cookies and external services</h2>
      <p>
        Essential HTTP-only cookies support login, callback security and your
        session. Sessions expire after seven days. Profile avatars and beatmap
        covers, when displayed, load from osu!’s image services. No advertising
        or analytics cookies are used.
      </p>
      <h2>Retention and requests</h2>
      {privacyReady() && contact ? (
        <>
          <p className="preserve-lines">
            {process.env.PRIVACY_RETENTION_NOTICE}
          </p>
          <p>
            For access, correction or deletion requests, contact the designated
            OCLR administrator using their osu! profile.
          </p>
          <a className="button secondary" href={contact.url}>
            {contact.label} →
          </a>
        </>
      ) : (
        <p className="notice">
          The organizer’s privacy contact and retention policy are awaiting
          confirmation. Sign-in and data collection remain unavailable until
          these are configured.
        </p>
      )}
    </div>
  );
}
