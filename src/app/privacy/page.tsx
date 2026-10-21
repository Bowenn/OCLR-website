import { getAppTranslations } from "@/i18n/server";
import { useAppTranslations } from "@/i18n/shared";
import { PageHeading } from "@/components/ui";
import { privacyContact, privacyReady } from "@/lib/auth/config";
export async function generateMetadata() {
  const tr = await getAppTranslations();
  return { title: tr("Privacy") };
}

export default function Privacy() {
  const tr = useAppTranslations();

  const contact = privacyContact();
  // Keep stored policy terms intact; public contact is exclusively through osu!.
  const retentionNotice = process.env.PRIVACY_RETENTION_NOTICE?.replace(
    /(?:mailto:)?[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)+/gi,
    "the designated osu! contact",
  );
  return (
    <div className="container page prose">
      <PageHeading eyebrow={tr("YOUR DATA")} title={tr("Privacy at OCLR")}>
        {tr("How osu! Chinese League Rookie uses your information.")}
      </PageHeading>
      <h2>{tr("Your account and applications")}</h2>
      <p>
        {tr(
          "We store your osu! ID, display name and a secure login session. We never receive your osu! password or retain your OAuth access and refresh tokens.",
        )}
      </p>
      <p>
        {tr(
          "Applications include your answers, any rules or eligibility acknowledgment, status and submission dates. Only authorized staff can review them. Acceptance alone does not publish your application or assign you a team.",
        )}
      </p>
      <h2>{tr("What becomes public")}</h2>
      <p>
        {tr(
          "Accepted registrations automatically appear in the published tournament’s Players directory with your osu! username, osu! ID and participation status. Pending, rejected and withdrawn applications are not listed. Application answers, contact details and staff review notes stay private. Captain appointments, team identities and finalized rosters require their separate release. Released mappools and approved, published results, scores and multiplayer source links are visible without signing in.",
        )}
      </p>
      <p>
        {tr(
          "Published profiles may include public osu! statistics, cached with an update time. Older data is labeled when osu! is unavailable. Staff profile lookups do not publish applications or determine eligibility.",
        )}
      </p>
      <h2>{tr("Staff access and services")}</h2>
      <p>
        {tr(
          "Authorized referees and administrators review player IDs and game scores. Unreviewed imports, internal notes and score evidence stay private. Staff actions are logged with the operator, changes and time for accountability.",
        )}
      </p>
      <p>
        {tr(
          "Essential cookies secure sign-in and sessions, which expire after seven days. Avatars and beatmap covers load from osu! image services. We use no advertising or analytics cookies.",
        )}
      </p>
      <p>
        {tr(
          "We remember your language and tournament appearance choices for up to one year. These preference cookies do not track you.",
        )}
      </p>
      <h2>{tr("Retention and requests")}</h2>
      {privacyReady() && contact ? (
        <>
          <p className="preserve-lines">{retentionNotice}</p>
          <p>
            {tr(
              "To request access, correction or deletion of your information, contact the OCLR Admin on osu!.",
            )}
          </p>
          <a className="button secondary" href={contact.url}>
            {contact.label}
          </a>
        </>
      ) : (
        <p className="notice">
          {tr(
            "The organizer’s privacy contact and retention policy are awaiting confirmation. Sign-in and data collection remain unavailable until these are configured.",
          )}
        </p>
      )}
    </div>
  );
}
