import { PageHeading } from "@/components/ui";
import { privacyReady } from "@/lib/auth/config";
export const metadata = { title: "Privacy" };
export default function Privacy() {
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
        approved questions, rules acknowledgment, status and timestamps.
        Authorized staff can review them. Applications are private; acceptance
        does not automatically publish your identity or assign you to a team.
      </p>
      <h2>Cookies and external services</h2>
      <p>
        Essential HTTP-only cookies support login, callback security and your
        session. Sessions expire after seven days. Profile avatars, when
        displayed, load from osu!’s image service. No advertising or analytics
        cookies are used.
      </p>
      <h2>Retention and requests</h2>
      {privacyReady() ? (
        <>
          <p className="preserve-lines">
            {process.env.PRIVACY_RETENTION_NOTICE}
          </p>
          <p>
            For access, correction or deletion requests, contact{" "}
            <a
              className="text-link"
              href={`mailto:${process.env.PRIVACY_CONTACT_EMAIL}`}
            >
              {process.env.PRIVACY_CONTACT_EMAIL}
            </a>
            .
          </p>
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
